import * as vscode from 'vscode';
import AppMapCollection from '../services/appmapCollection';
import AppMapLoader from '../services/appmapLoader';
import buildOpenAIApi from '../lib/buildOpenAIApi';
import assert from 'assert';
import {
  ChatCompletionRequestMessage,
  ChatCompletionRequestMessageRoleEnum,
  OpenAIApi,
} from 'openai';
import loadSnippet, { DEFAULT_SPAN } from '../lib/snippet';
import filesUnknownToGit from '../lib/filesUnknownToGit';
import filesModifiedInGit from '../lib/filesModifiedInGit';
import { suggestFix } from '../lib/suggestFix';
import { debug } from 'console';
import { isAbsolute } from 'path';

export class AppMapPickItem implements vscode.QuickPickItem {
  constructor(public appmap: AppMapLoader) {}

  get label(): string {
    return this.appmap.descriptor.metadata?.name || '<unnamed appmap>';
  }
}

async function fixFailedTest(appmapLoader: AppMapLoader, openAI: OpenAIApi) {
  const appmap = await appmapLoader.loadAppMap();
  const language = appmap.metadata?.language?.name;

  const folder = vscode.workspace.workspaceFolders?.find((folder) =>
    appmapLoader.descriptor.resourceUri.fsPath.startsWith(folder.uri.fsPath)
  );
  if (!folder) return;

  const systemMessages: ChatCompletionRequestMessage[] = [
    {
      content: `You are a software developer fixing problems in a codebase`,
      role: 'system',
    },
  ];
  if (language)
    systemMessages.push({ content: `Programming language: ${language}`, role: 'system' });

  if (appmap.metadata.source_location) {
    const snippet = await loadSnippet(folder, appmap.metadata.source_location, 0, DEFAULT_SPAN * 2);
    if (snippet) {
      const content = [
        `Test case${snippet.lineno ? ' begins at line ' + snippet.lineno : ''}: ${snippet.path}`,
        '',
        snippet.lines.join('\n'),
      ].join('\n');
      systemMessages.push({ content, role: 'system' });
    }
  }

  const userMessages: ChatCompletionRequestMessage[] = [];
  if (appmap.metadata.test_failure?.message) {
    userMessages.push({
      content: `Test failed: ${appmap.metadata.test_failure.message}`,
      role: 'user',
    });
  }

  if (appmap.metadata.test_failure?.location) {
    const snippet = await loadSnippet(folder, appmap.metadata.test_failure.location);
    if (snippet) {
      const content = [
        '',
        `Test failure${snippet.lineno ? ' occurred at line ' + snippet.lineno : ''}: ${
          snippet.path
        }`,
        snippet.lines.join('\n'),
      ].join('\n');
      userMessages.push({ content, role: 'user' });
    }
  }

  const uniqueExceptions = new Set<string>();
  for (const exceptionEvent of appmap.events.filter(
    (event) => event.exceptions && event.exceptions.length
  )) {
    for (const exception of exceptionEvent.exceptions) {
      const location = [exception.path, exception.lineno].filter(Boolean).join(':');
      const exceptionId = [exception.class, location].filter(Boolean).join(':');
      if (uniqueExceptions.has(exceptionId)) continue;

      uniqueExceptions.add(exceptionId);

      const snippet = await loadSnippet(folder, location);
      if (!snippet) continue;

      const content = [
        '',
        `Exception ${snippet.lineno ? ' occurred at line ' + snippet.lineno : ''}: ${snippet.path}`,
        snippet.lines.join('\n'),
      ].join('\n');
      userMessages.push({ content, role: 'user' });
    }
  }

  const outOfDateFiles = new Set([
    ...(await filesUnknownToGit(folder.uri.fsPath)),
    ...(await filesModifiedInGit(folder.uri.fsPath)),
  ]);
  const snippetLocations = new Set<string>();
  const snippetMessages: string[] = [];
  for (const event of appmap.events) {
    if (!(event.path && event.lineno)) continue;

    let { path } = event;
    if (isAbsolute(path) && path.startsWith(folder.uri.fsPath))
      path = path.slice(folder.uri.fsPath.length + 1);

    if (!outOfDateFiles.has(event.path)) continue;

    const location = [path, event.lineno].join(':');
    if (snippetLocations.has(location)) continue;
    snippetLocations.add(location);

    const snippet = await loadSnippet(folder, location, 0, DEFAULT_SPAN);
    if (!snippet) continue;

    const content = [
      '',
      `Code executed ${snippet.lineno ? ' at line ' + snippet.lineno : ''}: ${snippet.path}`,
      snippet.lines.join('\n'),
    ].join('\n');
    snippetMessages.push(content);
  }

  userMessages.push(
    ...snippetMessages
      .slice(0, 4) // TODO: Limiting to 4 of these for now, to stay under the token limit
      .map((content) => ({ content, role: 'user' as ChatCompletionRequestMessageRoleEnum }))
  );

  userMessages.push({
    content: `Analyze the problem, then provide a fixed version of the code, by generating one or more complete ${
      language ? language : ''
    } functions`,
    role: 'user' as ChatCompletionRequestMessageRoleEnum,
  });

  const title = appmap.metadata.test_failure?.message || appmap.metadata.name || 'Test failure';
  await suggestFix(openAI, title, systemMessages, userMessages);
}

export default function register(
  context: vscode.ExtensionContext,
  appmapCollection: AppMapCollection
): void {
  context.subscriptions.push(
    vscode.commands.registerCommand('appmap.fixTest', async (appmapUri?: vscode.Uri) => {
      let appmap: AppMapLoader | undefined;
      if (appmapUri) {
        appmap = appmapCollection
          .allAppMaps()
          .find((appmap) => appmap.descriptor.resourceUri === appmapUri);
      } else {
        const choices = (
          appmapCollection
            .allAppMaps()
            .filter(
              (appmap) => appmap.descriptor.metadata?.test_status === 'failed'
            ) as AppMapLoader[]
        )
          .map((appmap) => new AppMapPickItem(appmap))
          .sort((a, b) => a.label.localeCompare(b.label));

        const selection = await vscode.window.showQuickPick(choices);
        if (!selection) return;

        appmap = selection.appmap;
      }
      if (!appmap) return;

      const openAI = await buildOpenAIApi(context);
      if (!openAI) return;

      await vscode.window.withProgress(
        {
          title: `Analyzing failed test`,
          location: vscode.ProgressLocation.Notification,
        },
        async () => {
          assert(appmap);
          try {
            await fixFailedTest(appmap, openAI);
          } catch (e) {
            debug(e);
            vscode.window.showErrorMessage(`Failed to analyze failed test: ${e}`);
          }
        }
      );
    })
  );
}