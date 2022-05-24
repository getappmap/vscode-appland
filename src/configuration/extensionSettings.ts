import * as vscode from 'vscode';

export default {
  uploadURL: (): vscode.Uri => {
    const configUrl: string = vscode.workspace
      .getConfiguration('appMap')
      .get('applandUrl') as string;
    return vscode.Uri.parse(configUrl);
  },

  inspectEnabled: (): boolean =>
    [true, 'true'].includes(
      vscode.workspace.getConfiguration('appMap').get('inspectEnabled') || false
    ),

  findingsEnabled: (): boolean =>
    [true, 'true'].includes(
      vscode.workspace.getConfiguration('appMap').get('findingsEnabled') || false
    ),

  indexCommand: (): string | string[] =>
    vscode.workspace.getConfiguration('appMap').get('indexCommand') || [
      'appmap',
      'index',
      '--watch',
      '--appmap-dir',
      '.',
    ],

  scanCommand: (): string | string[] =>
    vscode.workspace.getConfiguration('appMap').get('scanCommand') || [
      'scanner',
      'scan',
      '--watch',
      '--appmap-dir',
      '.',
    ],
};
