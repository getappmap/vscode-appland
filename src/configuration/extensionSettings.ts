import { DefaultApiURL } from '@appland/client';
import * as vscode from 'vscode';
import { version, publisher, name } from '../../package.json';

const EXTENSION_ID = `${publisher}.${name}`;
const EXTENSION_VERSION = `${version}`;

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

  public static get appMapCommandLineEnvironment(): Readonly<Record<string, string>> {
    const env = vscode.workspace.getConfiguration('appMap').get('commandLineEnvironment') || {};
    const result = { ...env } as Record<string, string>;

    const telemetryConfig = this.telemetryConfiguration;
    if (telemetryConfig.backend === 'splunk') {
      result.APPMAP_TELEMETRY_BACKEND ??= 'splunk';
      result.APPMAP_TELEMETRY_DISABLED ??= 'false';
      if (telemetryConfig.url) result.SPLUNK_URL ??= telemetryConfig.url;
      if (telemetryConfig.token) result.SPLUNK_TOKEN ??= telemetryConfig.token;
      if (telemetryConfig.ca) result.SPLUNK_CA_CERT ??= telemetryConfig.ca;
    }

    result.APPMAP_TELEMETRY_PROPERTIES ??= JSON.stringify({
      extname: EXTENSION_ID,
      extversion: EXTENSION_VERSION,
      ide: vscode.env.appName,
      ideversion: vscode.version,
    });

    return result;
  }

  /* Get the (hidden) telemetry configuration from settings. */
  public static get telemetryConfiguration(): TelemetryConfiguration {
    const telemetryConfig = vscode.workspace.getConfiguration('appMap')?.get('telemetry');
    // Ensure the config is a simple object with string keys and values.
    if (telemetryConfig && typeof telemetryConfig === 'object' && !Array.isArray(telemetryConfig)) {
      return telemetryConfig as TelemetryConfiguration;
    }
    return {};
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

  public static get preferredCopilotModel(): string | undefined {
    return vscode.workspace.getConfiguration('appMap').get('copilot.preferredModel') || 'gpt-4o';
  }

  public static setPreferredCopilotModel(model: string | undefined): Thenable<void> {
    return vscode.workspace
      .getConfiguration('appMap')
      .update('copilot.preferredModel', model, true);
  }

  public static get useAnimation(): boolean {
    return [true, 'true'].includes(
      vscode.workspace.getConfiguration('appMap').get('useAnimation') || false
    );
  }

  public static get autoUpdateTools(): boolean {
    return vscode.workspace.getConfiguration('appMap').get<boolean>('autoUpdateTools') ?? true;
  }
}

export interface TelemetryConfiguration {
  backend?: 'appinsights' | 'splunk';
  url?: string;
  token?: string;
  ca?: string;
}
