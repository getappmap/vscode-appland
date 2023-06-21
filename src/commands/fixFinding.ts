import * as vscode from 'vscode';
import { ResolvedFinding } from '../services/resolvedFinding';
import AnalysisManager from '../services/analysisManager';
import {
  ChatCompletionRequestMessage,
  ChatCompletionRequestMessageRoleEnum,
  Configuration,
  OpenAIApi,
} from 'openai';
import assert from 'assert';
import { Event, buildAppMap } from '@appland/models';
import { readFile } from 'fs/promises';
import loadSnippet, { DEFAULT_SPAN } from '../lib/snippet';
import { suggestFix } from '../lib/suggestFix';
import { debug } from 'console';

export class FindingPickItem implements vscode.QuickPickItem {
  constructor(public finding: ResolvedFinding) {}

  get label(): string {
    return [this.finding.finding.ruleTitle, `(${this.finding.finding.hash_v2.slice(0, 8)})`].join(
      ' '
    );
  }
}

export async function fixFinding(finding: ResolvedFinding, openAI: OpenAIApi) {
  const appmap = buildAppMap()
    .source(await readFile(finding.finding.appMapFile, 'utf-8'))
    .build();
  const language = appmap.metadata?.language?.name;

  const scopeEvent = appmap.events[finding.finding.scope.id - 1];
  const event = appmap.events[finding.finding.event.id - 1];
  const stackFunctions: string[] = [];
  {
    let parent: Event | undefined = event;
    while (parent) {
      stackFunctions.push(parent.codeObject.fqid);
      parent = parent.parent;
    }
  }

  let participatingEvents = Object.values(finding.finding.participatingEvents || {});
  if (participatingEvents.length === 0) participatingEvents = [finding.finding.event];

  const locations = [
    ...participatingEvents.map((event) => [event.path, event.lineno].filter(Boolean).join(':')),
    ...finding.finding.stack,
  ];

  const snippetLocations = new Set<string>();
  const codeSnippets = new Array<string>();
  for (const location of locations) {
    if (snippetLocations.has(location)) continue;

    // TODO: Determine the function span more accurately
    const snippet = await loadSnippet(finding.folder, location, 0, DEFAULT_SPAN * 2);
    if (!snippet) continue;

    if (snippet) snippetLocations.add(location);
    codeSnippets.push(['', `Source file: ${snippet.path}`, snippet.lines.join('\n')].join('\n'));
  }

  const systemMessages: ChatCompletionRequestMessage[] = [
    {
      content: `You are a software developer fixing problems in a codebase`,
      role: 'system',
    },
  ];
  if (language)
    systemMessages.push({ content: `Programming language: ${language}`, role: 'system' });

  let relatedReferences: string[] = [];
  if (finding.rule.references && Object.keys(finding.rule.references).length > 0)
    relatedReferences = Object.entries(finding.rule.references || {})
      .map(([key, value]) => [key, value].join(' '))
      .map((reference) => `Related reference: ${reference}`);

  const userMessages: ChatCompletionRequestMessage[] = [
    `The code contains a ${finding.rule.impactDomain} problem: ${finding.rule.title}`,
    `Specifically: ${finding.finding.message}`,
    ...relatedReferences,
    `The problem occurs within ${scopeEvent.codeObject.fqid}. It's related to the following code:`,
    ...codeSnippets,
  ].map((message) => ({
    content: message,
    role: 'user' as ChatCompletionRequestMessageRoleEnum,
  }));
  userMessages.push({
    content: `Describe the problem in the style of a code review comment, then suggest a fixed version of the code by generating one or more complete ${
      language ? language : ''
    } functions`,
    role: 'user' as ChatCompletionRequestMessageRoleEnum,
  });

  await suggestFix(openAI, finding.rule.title, systemMessages, userMessages);
}

export default function register(context: vscode.ExtensionContext): void {
  context.subscriptions.push(
    vscode.commands.registerCommand('appmap.fixFinding', async (findingHash?: string) => {
      const findingsIndex = AnalysisManager.findingsIndex;
      if (!findingsIndex) return;

      if (!findingHash) {
        const uniqueFindingHashes = new Set();
        const findings = (
          findingsIndex
            .findings()
            .map((finding) => {
              if (uniqueFindingHashes.has(finding.finding.hash_v2)) return;

              uniqueFindingHashes.add(finding.finding.hash_v2);
              return finding;
            })

            .filter(Boolean) as ResolvedFinding[]
        ).sort((a, b) => a.rule.title.localeCompare(b.rule.title));

        const choices = findings.map<FindingPickItem>((finding) => new FindingPickItem(finding));

        const selection = await vscode.window.showQuickPick(choices);
        if (!selection) return;

        findingHash = selection.finding.finding.hash_v2;
      }

      const findings = findingsIndex.findingsByHash(findingHash);
      if (!findings || findings.length === 0) return;

      const finding = findings[0];
      assert(finding);

      let gptKey = await context.secrets.get('openai.gptKey');
      if (!gptKey) {
        gptKey = await vscode.window.showInputBox({ title: `Enter your OpenAI API key` });
        if (!gptKey) return;

        await context.secrets.store('openai.gptKey', gptKey);
      }

      const openAI = new OpenAIApi(new Configuration({ apiKey: gptKey }));

      await vscode.window.withProgress(
        {
          title: `Analyzing: ${finding.rule.title}`,
          location: vscode.ProgressLocation.Notification,
        },
        async () => {
          assert(findingHash);
          try {
            await fixFinding(finding, openAI);
          } catch (e) {
            debug((e as any).toString());
            vscode.window.showErrorMessage(`Failed to analyze finding: ${e}`);
          }
        }
      );
    })
  );
}
