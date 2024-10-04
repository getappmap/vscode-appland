import { DefaultApiURL } from '@appland/client';
import * as vscode from 'vscode';

export default class ExtensionSettings {
  public static get appMapServerURL(): vscode.Uri {
    const configUrl = vscode.workspace.getConfiguration('appMap').get('applandUrl') as string;
    return vscode.Uri.parse(configUrl);
  }

  public static get inspectEnabled(): boolean {
    return [true, 'true'].includes(
      vscode.workspace.getConfiguration('appMap').get('inspectEnabled') || false
    );
  }

  public static get viewConfiguration(): string | undefined {
    return vscode.workspace.getConfiguration('appMap').get('viewConfiguration');
  }

  public static get defaultDiagramView(): string | undefined {
    return vscode.workspace.getConfiguration('appMap').get('defaultDiagramView');
  }

  public static plantUMLJarPath(): string | undefined {
    return vscode.workspace.getConfiguration('appMap').get<string>('plantUmlJarPath');
  }

  public static get appMapCommandLineToolsPath(): string | undefined {
    return vscode.workspace.getConfiguration('appMap').get('commandLineToolsPath');
  }

  public static get appMapCommandLineVerbose(): boolean {
    return [true, 'true'].includes(
      vscode.workspace.getConfiguration('appMap').get('commandLineVerbose') || false
    );
  }

  public static get appMapCommandLineEnvironment(): Readonly<Record<string, string>> | undefined {
    return vscode.workspace.getConfiguration('appMap').get('commandLineEnvironment');
  }

  public static get appMapIndexOptions(): string | undefined {
    return vscode.workspace.getConfiguration('appMap').get('indexOptions');
  }

  public static get apiUrl(): string {
    return vscode.workspace.getConfiguration('appMap').get('apiUrl') || DefaultApiURL;
  }

  public static get navieRpcPort(): number | undefined {
    const port = vscode.workspace.getConfiguration('appMap').get('navie.rpcPort');
    if (port && typeof port === 'number' && port > 0) return port;
  }

  public static get navieContextTokenLimit(): number | undefined {
    const limit = vscode.workspace.getConfiguration('appMap').get('navie.contextTokenLimit');
    if (limit && typeof limit === 'number' && limit > 0) return limit;
  }

  public static get useVsCodeLM(): boolean {
    return [true, 'true'].includes(
      vscode.workspace.getConfiguration('appMap').get('navie.useVSCodeLM') || false
    );
  }

  public static get scannerEnabled(): boolean {
    return [true, 'true'].includes(
      vscode.workspace.getConfiguration('appMap').get('scannerEnabled') || false
    );
  }

  // Perform any context bindings that are dependent on settings.
  public static bindContext(): void {
    vscode.commands.executeCommand('setContext', 'appmap.scannerEnabled', this.scannerEnabled);
  }

  public static get maxPinnedFileSizeKB(): number {
    const ret = vscode.workspace.getConfiguration('appMap').get('maxPinnedFileSizeKB') as number;
    return ret !== undefined ? ret : 20000;
  }

  public static get useAnimation(): boolean {
    return [true, 'true'].includes(
      vscode.workspace.getConfiguration('appMap').get('useAnimation') || false
    );
  }
}
