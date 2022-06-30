import * as vscode from 'vscode';

export default {
  uploadURL: (): vscode.Uri => {
    const configUrl: string = vscode.workspace
      .getConfiguration('appMap')
      .get('applandUrl') as string;
    return vscode.Uri.parse(configUrl);
  },

  indexEnabled: (): boolean =>
    [true, 'true'].includes(
      vscode.workspace.getConfiguration('appMap').get('indexEnabled') || false
    ),

  findingsEnabled: (): boolean =>
    [true, 'true'].includes(
      vscode.workspace.getConfiguration('appMap').get('findingsEnabled') || false
    ),

  instructionsEnabled: (): boolean =>
    [true, 'true'].includes(
      vscode.workspace.getConfiguration('appMap').get('instructionsEnabled') || false
    ),

  inspectEnabled: (): boolean =>
    [true, 'true'].includes(
      vscode.workspace.getConfiguration('appMap').get('inspectEnabled') || false
    ),

  indexCommand: (): string | string[] =>
    vscode.workspace.getConfiguration('appMap').get('indexCommand') || [
      'appmap',
      'index',
      '--watch',
    ],

  scanCommand: (): string | string[] =>
    vscode.workspace.getConfiguration('appMap').get('scanCommand') || [
      'scanner',
      'scan',
      '--watch',
    ],

  dependsCommand: (): string | string[] =>
    vscode.workspace.getConfiguration('appMap').get('dependsCommand') || [
      'appmap',
      'depends',
      '--base-dir',
      '${workspaceFolder}',
      '--appmap-dir',
      '${workspaceFolder}',
    ],
};
