import * as vscode from 'vscode';

export type AppMapQuickPickItem = vscode.QuickPickItem & {
  resourceUri: vscode.Uri;
};
