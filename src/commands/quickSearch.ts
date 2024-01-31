import { relative } from 'path';
import * as vscode from 'vscode';

export type CodeSelection = {
  path: string;
  lineStart: number;
  lineEnd: number;
  code: string;
  language: string;
};

export class QuickSearchProvider implements vscode.CodeActionProvider {
  provideCodeActions(
    document: vscode.TextDocument,
    range: vscode.Selection | vscode.Range
  ): vscode.ProviderResult<(vscode.CodeAction | vscode.Command)[]> {
    const selectedCode = document.getText(range).trim();
    if (selectedCode === '') return;

    const workspaceFolder = vscode.workspace.getWorkspaceFolder(document.uri);
    if (!workspaceFolder) return [];

    const codeSelection: CodeSelection = {
      path: relative(workspaceFolder.uri.fsPath, document.fileName),
      lineStart: range.start.line,
      lineEnd: range.end.line,
      code: selectedCode,
      language: document.languageId,
    };

    const codeAction = new vscode.CodeAction(
      'Explain with AppMap AI',
      vscode.CodeActionKind.Refactor
    );
    codeAction.command = {
      command: 'appmap.quickExplain',
      title: 'Explain with AppMap AI',
      arguments: [workspaceFolder.uri, codeSelection],
    };
    return [codeAction];
  }

  resolveCodeAction?(codeAction: vscode.CodeAction): vscode.ProviderResult<vscode.CodeAction> {
    return codeAction;
  }
}

export default function quickSearch(context: vscode.ExtensionContext) {
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
    vscode.commands.registerCommand(
      'appmap.quickExplain',
      (workspaceUri: vscode.Uri, selectedCode: string) => {
        const workspace = vscode.workspace.getWorkspaceFolder(workspaceUri);
        vscode.commands.executeCommand('appmap.explain', workspace, selectedCode);
      }
    )
  );
}
