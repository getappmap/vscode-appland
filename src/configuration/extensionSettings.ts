import * as vscode from 'vscode';

export default class ExtensionSettings {
  public static get appMapServerURL(): vscode.Uri {
    const configUrl: string = vscode.workspace
      .getConfiguration('appMap')
      .get('applandUrl') as string;
    return vscode.Uri.parse(configUrl);
  }

  public static get inspectEnabled(): boolean {
    return [true, 'true'].includes(
      vscode.workspace.getConfiguration('appMap').get('inspectEnabled') || false
    );
  }

  public static get sequenceDiagramEnabled(): boolean {
    return [true, 'true'].includes(
      vscode.workspace.getConfiguration('appMap').get('sequenceDiagramEnabled') || false
    );
  }

  public static get viewConfiguration(): string | undefined {
    return vscode.workspace.getConfiguration('appMap').get('viewConfiguration');
  }

  public static get findingsEnabled(): boolean {
    return [true, 'true'].includes(
      vscode.workspace.getConfiguration('appMap').get('findingsEnabled') || false
    );
  }

  public static get plantUMLJarPath(): string | undefined {
    return vscode.workspace.getConfiguration('appMap').get('plantUmlJarPath');
  }

  public static get appMapCommandLineToolsPath(): string | undefined {
    return vscode.workspace.getConfiguration('appMap').get('commandLineToolsPath');
  }

  public static async enableFindings(): Promise<void> {
    vscode.workspace.getConfiguration('appMap').update('findingsEnabled', true);
  }
}
