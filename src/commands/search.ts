import * as vscode from 'vscode';
import { SearchRpc } from '@appland/rpc';
import { warn } from 'console';
import { AppMapFilter, serializeFilter } from '@appland/models';
import { FormatType, format, unparseDiagram } from '@appland/sequence-diagram';

import IndexProcessWatcher from '../services/indexProcessWatcher';
import { workspaceServices } from '../services/workspaceServices';
import { NodeProcessService } from '../services/nodeProcessService';
import { ProcessId } from '../services/processWatcher';
import renderSearchResults from '../lib/renderSearchResults';
import buildOpenAIApi from '../lib/buildOpenAIApi';
import { explain } from '../lib/explain';
import lookupSourceCode from './lookupSourceCode';

async function promptForSearch(context: vscode.ExtensionContext) {
  const query = await vscode.window.showInputBox({
    placeHolder: 'Search AppMaps',
    prompt: 'Enter a search query',
  });
  if (!query) return;

  const workspaces = vscode.workspace.workspaceFolders;
  if (!workspaces) return;

  let workspaceFolder: vscode.WorkspaceFolder | undefined;
  if (workspaces.length === 1) {
    workspaceFolder = workspaces[0];
  } else {
    workspaceFolder = await vscode.window.showWorkspaceFolderPick({
      placeHolder: 'Select a workspace folder',
    });
  }
  if (!workspaceFolder) return;

  return performSearch(context, query, workspaceFolder.uri);
}

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
    const sequenceDiagrams = new Array<string>();
    const codeSnippets = new Map<string, string>();

    const buildSequenceDiagram = async (result: SearchRpc.SearchResult) => {
      const codeObjects = result.events.map((event) => event.fqid);
      const appmapFilter = new AppMapFilter();
      appmapFilter.declutter.hideExternalPaths.on = true;
      appmapFilter.declutter.context.on = true;
      appmapFilter.declutter.context.names = codeObjects;
      const filterState = serializeFilter(appmapFilter);

      const sequenceDiagramData = await rpcClient.sequenceDiagram(
        result.appmap,
        undefined,
        filterState
      );
      const sequenceDiagram = unparseDiagram(sequenceDiagramData);
      const plantUML = format(FormatType.PlantUML, sequenceDiagram, result.appmap);
      sequenceDiagrams.push(plantUML.diagram);
    };

    for (const result of searchResults.results.slice(0, 3)) {
      await buildSequenceDiagram(result);
      for (const event of result.events) {
        if (!event.location) continue;

        if (codeSnippets.has(event.location)) continue;

        const snippet = await lookupSourceCode(workspaceUri.fsPath, event.location);
        if (snippet) codeSnippets.set(event.location, snippet);
      }
    }

    const openAI = await buildOpenAIApi(context);
    if (openAI) {
      explanation = await explain(openAI, query, sequenceDiagrams, codeSnippets);
    }
  }

  const resultsPage = await renderSearchResults(
    rpcClient,
    workspace,
    query,
    tokenizedQuery,
    explanation,
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
  context.subscriptions.push(
    vscode.languages.registerCodeActionsProvider(
      [
        { language: 'ruby' },
        { language: 'java' },
        { language: 'python' },
        { language: 'javascript' },
      ],
      new QuickSearchProvider()
    )
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('appmap.quickSearch', performSearch.bind(null, context))
  );
  context.subscriptions.push(
    vscode.commands.registerCommand('appmap.search', promptForSearch.bind(null, context))
  );
}
