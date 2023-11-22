import * as vscode from 'vscode';
import IndexProcessWatcher from '../services/indexProcessWatcher';
import { workspaceServices } from '../services/workspaceServices';
import { NodeProcessService } from '../services/nodeProcessService';
import { ProcessId } from '../services/processWatcher';
import { warn } from 'console';
import renderSearchResults from '../lib/renderSearchResults';
import { AppMapFilter, serializeFilter } from '@appland/models';
import { FormatType, format, unparseDiagram } from '@appland/sequence-diagram';
import buildOpenAIApi from '../lib/buildOpenAIApi';
import { explain } from '../lib/explain';
import lookupSourceCode from './lookupSourceCode';

async function performSearch(
  context: vscode.ExtensionContext,
  query: string,
  workspaceUri: vscode.Uri
) {
  const workspace = vscode.workspace.getWorkspaceFolder(workspaceUri);
  if (!workspace) {
    warn('No workspace folder found for URI', workspaceUri);
    return;
  }

  const processServiceInstance = workspaceServices().getServiceInstanceFromClass(
    NodeProcessService,
    workspace
  );
  if (!processServiceInstance) {
    warn('No NodeProcessService instance found for workspace', workspace);
    return;
  }

  const indexProcess = processServiceInstance.processes.find(
    (proc) => proc.id === ProcessId.Index
  ) as IndexProcessWatcher;
  if (!indexProcess) {
    warn(`No ${ProcessId.Index} helper process found for workspace`, workspace);
    return;
  }

  if (!indexProcess.isRpcAvailable()) {
    warn('AppMap RPC is not available');
    return;
  }

  const rpcClient = indexProcess.rpcClient();

  const erasePatterns = [
    // Characters that have special search meaning in lunr
    '*',
    ':',
    '^',
    '~',
    '+',
    '-',
    // Other characters and reserved words that we want to ignore
    '_',
    '\n',
    '.',
    '=',
    ',',
    '(',
    ')',
    '[',
    ']',
    '#',
    '/',
    '@',
    '>',
    "'",
    '"',
    /\bdef\b/g,
    /\bend\b/g,
    /\bfunction\b/g,
    /\bmodule\b/g,
    /\bclass\b/g,
    /\binterface\b/g,
    /\bprivate\b/g,
    /\bpublic\b/g,
    /\bprotected\b/g,
  ];

  let tokenizedQuery = query;
  for (const pattern of erasePatterns) {
    tokenizedQuery = tokenizedQuery.replaceAll(pattern, ' ');
  }

  const searchResults = await rpcClient.search(tokenizedQuery, 5);

  let explanation: string | undefined;
  {
    const firstResult = searchResults.results[0];
    const codeObjects = firstResult.events.map((event) => event.fqid);
    const appmapFilter = new AppMapFilter();

    appmapFilter.declutter.hideExternalPaths.on = true;
    appmapFilter.declutter.context.on = true;
    appmapFilter.declutter.context.names = codeObjects;

    const filterState = serializeFilter(appmapFilter);
    const sequenceDiagramData = await rpcClient.sequenceDiagram(
      firstResult.appmap,
      undefined,
      filterState
    );
    const sequenceDiagram = unparseDiagram(sequenceDiagramData);
    const plantUML = format(FormatType.PlantUML, sequenceDiagram, firstResult.appmap);

    const doc = await vscode.workspace.openTextDocument({
      language: 'plantuml',
      content: plantUML.diagram,
    });
    await vscode.window.showTextDocument(doc, { preview: false });

    const codeSnippets = new Map<string, string>();
    for (const event of firstResult.events) {
      if (!event.location) continue;

      const snippet = await lookupSourceCode(workspaceUri.fsPath, event.location);
      if (snippet) codeSnippets.set(event.location, snippet);
    }

    const openAI = await buildOpenAIApi(context);
    if (openAI) {
      explanation = await explain(openAI, plantUML.diagram, codeSnippets);

      (firstResult as any).explanation = explanation;
    }
  }

  const resultsPage = await renderSearchResults(
    rpcClient,
    workspace,
    query,
    tokenizedQuery,
    searchResults
  );
  // Open as Markdown document
  const doc = await vscode.workspace.openTextDocument({
    language: 'markdown',
    content: resultsPage,
  });
  await vscode.window.showTextDocument(doc, { preview: false });
  await new Promise((resolve) => setTimeout(resolve, 500));
  await vscode.commands.executeCommand('markdown.showPreview', doc.uri);
}

class QuickSearchProvider implements vscode.CodeActionProvider {
  provideCodeActions(
    document: vscode.TextDocument,
    range: vscode.Selection | vscode.Range,
    _context: vscode.CodeActionContext,
    _token: vscode.CancellationToken
  ): vscode.ProviderResult<(vscode.CodeAction | vscode.Command)[]> {
    const selectedCode = document.getText(range).trim();
    if (selectedCode === '') return;

    const workspaceFolder = vscode.workspace.getWorkspaceFolder(document.uri);
    if (!workspaceFolder) return [];

    const codeAction = new vscode.CodeAction('Search AppMaps', vscode.CodeActionKind.Refactor);
    codeAction.command = {
      command: 'appmap.quickSearch',
      title: 'Search AppMaps',
      arguments: [selectedCode, workspaceFolder.uri],
    };
    return [codeAction];
  }

  resolveCodeAction?(
    codeAction: vscode.CodeAction,
    _token: vscode.CancellationToken
  ): vscode.ProviderResult<vscode.CodeAction> {
    return codeAction;
  }
}

export function quickSearch(context: vscode.ExtensionContext) {
  const provider = vscode.languages.registerCodeActionsProvider(
    [
      { language: 'ruby' },
      { language: 'java' },
      { language: 'python' },
      { language: 'javascript' },
    ],
    new QuickSearchProvider()
  );
  context.subscriptions.push(provider);

  const command = vscode.commands.registerCommand(
    'appmap.quickSearch',
    performSearch.bind(null, context)
  );
  context.subscriptions.push(command);
}
