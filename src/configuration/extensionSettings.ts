import * as vscode from 'vscode';

export default {
  uploadURL: (): vscode.Uri => {
    const configUrl: string = vscode.workspace
      .getConfiguration('appMap')
      .get('applandUrl') as string;
    return vscode.Uri.parse(configUrl);
  },

  findingsEnabled: (): boolean =>
    [true, 'true'].includes(
      vscode.workspace.getConfiguration('appMap').get('findingsEnabled') || false
    ),

  inspectEnabled: (): boolean =>
    [true, 'true'].includes(
      vscode.workspace.getConfiguration('appMap').get('inspectEnabled') || false
    ),
};
