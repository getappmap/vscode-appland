import * as vscode from 'vscode';

export default {
  uploadURL: (): vscode.Uri => {
    const configUrl: string = vscode.workspace
      .getConfiguration('appMap')
      .get('applandUrl') as string;
    return vscode.Uri.parse(configUrl);
  },

  indexCommand: (): string | [string, string[]] =>
    vscode.workspace.getConfiguration('appMap').get('indexCommand') || [
      'npx',
      ['--no-install', '@appland/appmap', 'index', '--watch', '--appmap-dir', '.'],
    ],

  scanCommand: (): string | [string, string[]] =>
    vscode.workspace.getConfiguration('appMap').get('scanCommand') || [
      'npx',
      ['--no-install', '@appland/scanner', 'scan', '--watch', '--appmap-dir', '.'],
    ],
};
