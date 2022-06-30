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

  pythonEnabled: (): boolean =>
    [true, 'true'].includes(
      vscode.workspace.getConfiguration('appMap').get('pythonEnabled') || false
    ),
};
