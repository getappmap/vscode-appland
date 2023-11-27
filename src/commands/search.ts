import * as vscode from 'vscode';
import { SearchRpc } from '@appland/rpc';
import { warn } from 'console';
import { AppMapFilter, serializeFilter } from '@appland/models';

import IndexProcessWatcher from '../services/indexProcessWatcher';
import { workspaceServices } from '../services/workspaceServices';
import { NodeProcessService } from '../services/nodeProcessService';
import { ProcessId } from '../services/processWatcher';
import renderSearchResults from '../lib/renderSearchResults';
import buildOpenAIApi from '../lib/buildOpenAIApi';
import { explain } from '../lib/explain';
import lookupSourceCode from './lookupSourceCode';
import assert from 'assert';
import suggestVectorTerms from '../lib/suggestVectorTerms';
import { relative } from 'path';

const NUM_DIAGRAMS_TO_ANALYZE = 3;

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
): Promise<string | undefined> {
  const showError = async (message: string): Promise<string | undefined> => {
    return vscode.window.showErrorMessage(message);
  };

  const showAppMapSearchNotReadyError = async (): Promise<string | undefined> => {
    return showError('AppMap search is not ready yet. Please try again in a few seconds.');
  };

  const workspace = vscode.workspace.getWorkspaceFolder(workspaceUri);
  if (!workspace) {
    return showError(`No workspace folder found for URI: ${workspaceUri}`);
  }

  const processServiceInstance = workspaceServices().getServiceInstanceFromClass(
    NodeProcessService,
    workspace
  );
  if (!processServiceInstance) {
    warn(`No NodeProcessService instance found for workspace: ${workspace}`);
    return showAppMapSearchNotReadyError();
  }

  const indexProcess = processServiceInstance.processes.find(
    (proc) => proc.id === ProcessId.Index
  ) as IndexProcessWatcher;
  if (!indexProcess) {
    warn(`No ${ProcessId.Index} helper process found for workspace: ${workspace}`);
    return showAppMapSearchNotReadyError();
  }

  if (!indexProcess.isRpcAvailable()) {
    return showAppMapSearchNotReadyError();
  }
  const rpcClient = indexProcess.rpcClient();

  let searchResponse: SearchRpc.SearchResponse | undefined;
  let explanation: string | undefined;
  let vectorTerms: string[];

  const searchStep = async (): Promise<void> => {
    const openAI = await buildOpenAIApi(context);
    if (!openAI) return;

    vectorTerms = await suggestVectorTerms(openAI, query);
    searchResponse = await rpcClient.search(vectorTerms.join(' '), 5);
  };

  const explainStep = async () => {
    if (!searchResponse) return;

    const sequenceDiagrams = new Array<string>();
    const codeSnippets = new Map<string, string>();

    const buildSequenceDiagram = async (result: SearchRpc.SearchResult) => {
      const codeObjects = result.events.map((event) => event.fqid);
      const appmapFilter = new AppMapFilter();
      appmapFilter.declutter.hideExternalPaths.on = true;
      appmapFilter.declutter.context.on = true;
      appmapFilter.declutter.context.names = codeObjects;
      const filterState = serializeFilter(appmapFilter);

      const plantUML = await rpcClient.sequenceDiagram(
        result.appmap,
        undefined,
        filterState,
        'plantuml',
        { disableMarkup: true }
      );
      assert(typeof plantUML === 'string');
      sequenceDiagrams.push(plantUML);
    };

    for (const result of searchResponse.results.slice(0, NUM_DIAGRAMS_TO_ANALYZE)) {
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
      let answer = await explain(openAI, query, sequenceDiagrams, codeSnippets);

      const codeReferences = answer.match(/`[^`]+`/g);
      // Replace each codeReference that matches an actual file with [file](file)
      if (codeReferences) {
        for (const codeReference of codeReferences) {
          const file = codeReference.slice(1, -1);
          const fileMatches = await vscode.workspace.findFiles(
            new vscode.RelativePattern(workspace, file)
          );
          if (fileMatches.length === 1) {
            const fileMatch = relative(workspace.uri.fsPath, fileMatches[0].fsPath);
            answer = answer.replaceAll(codeReference, `[${file}](${fileMatch})`);
          }
        }
      }

      explanation = answer;
    }
  };

  const displaySearchResults = async () => {
    if (!searchResponse) return;

    const resultsPage = await renderSearchResults(
      rpcClient,
      workspace,
      query,
      vectorTerms.join(' '),
      explanation,
      searchResponse
    );
    const doc = await vscode.workspace.openTextDocument({
      language: 'markdown',
      content: resultsPage,
    });
    await vscode.window.showTextDocument(doc, { preview: false });
    await new Promise((resolve) => setTimeout(resolve, 500));
    await vscode.commands.executeCommand('markdown.showPreview', doc.uri);
  };

  vscode.window.withProgress(
    { title: 'Searching AppMaps', location: vscode.ProgressLocation.Notification },
    async (progress) => {
      progress.report({ message: 'Searching AppMaps' });
      await searchStep();
      progress.report({ message: 'Analyzing results' });
      await explainStep();
      progress.report({ message: 'Rendering results' });
      await displaySearchResults();
    }
  );
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
