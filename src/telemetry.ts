import * as vscode from 'vscode';
import TelemetryReporter from 'vscode-extension-telemetry';
import { version, publisher, name } from '../package.json';
import { getStringRecords } from './util';
import { PathLike } from 'fs';
import TelemetryResolver from './telemetry/telemetryResolver';
import { Properties, Metrics } from './telemetry/index';
import TelemetryDataProvider from './telemetry/telemetryDataProvider';

const EXTENSION_ID = `${publisher}.${name}`;
const EXTENSION_VERSION = `${version}`;

// This key is meant to be publically shared. However, I'm adding a simple
// obfuscation to mitigate key scraping bots on GitHub. The key is split on
// hypens and base64 encoded without padding.
// key.split('-').map((x) => x.toString('base64').replace(/=*/, ''))
const INSTRUMENTATION_KEY = ['NTBjMWE1YzI', 'NDliNA', 'NDkxMw', 'YjdjYw', 'ODZhNzhkNDA3NDVm']
  .map((x) => Buffer.from(x, 'base64').toString('utf8'))
  .join('-');

interface Event {
  readonly eventName: string;
  properties?: Array<TelemetryDataProvider<string>>;
  metrics?: Array<TelemetryDataProvider<number>>;
}

/**
 * An event is a uniquely identified collection of telemetry data. Events of the same `eventName` will often contain the
 * same properties and metrics. This map binds properties and metrics together under a common event.
 */
export const Events: { [key: string]: Event } = {
  PROJECT_OPEN: {
    eventName: 'project:open',
    properties: [
      Properties.Project.AGENT_VERSION_GLOBAL,
      Properties.Project.AGENT_VERSION_PROJECT,
      Properties.Project.IS_CONFIG_PRESENT,
      Properties.Project.LANGUAGE,
    ],
    // metrics: [Metrics.Project.EXAMPLE],
  },
  UPDATE_PROJECT_CONFIG: {
    eventName: 'project/config:update',
  },
};

/**
 * The primary interface for sending telemetry data.
 */
export default class Telemetry {
  private static reporter = new TelemetryReporter(
    EXTENSION_ID,
    EXTENSION_VERSION,
    INSTRUMENTATION_KEY
  );

  static register(context: vscode.ExtensionContext): void {
    context.subscriptions.push(this.reporter);
  }

  private static async performSendEvent(
    event: Event,
    rootDirectory: PathLike,
    relatedFile?: PathLike
  ): Promise<void> {
    const telemetry = new TelemetryResolver(rootDirectory, relatedFile);
    let properties: Record<string, string> | undefined;
    let metrics: Record<string, number> | undefined;

    if (event.properties) {
      properties = await telemetry.resolve(...event.properties);
    }

    if (event.metrics) {
      metrics = await telemetry.resolve(...event.metrics);
    }

    this.reporter.sendTelemetryEvent(event.eventName, properties, metrics);
  }

  static async sendEvent(event: Event): Promise<void> {
    const { workspaceFolders } = vscode.workspace;
    if (!workspaceFolders) {
      return;
    }

    if (!workspaceFolders.length) {
      return;
    }

    return await this.performSendEvent(event, workspaceFolders[0].uri.fsPath);
  }

  static async sendProjectEvent(event: Event, workspace: vscode.WorkspaceFolder): Promise<void> {
    return await this.performSendEvent(event, workspace.uri.fsPath);
  }

  static async sendProjectFileEvent(
    event: Event,
    workspace: vscode.WorkspaceFolder,
    relatedFile: PathLike
  ): Promise<void> {
    return await this.performSendEvent(event, workspace.uri.fsPath, relatedFile);
  }

  static reportAction(action: string, data: Record<string, string> | undefined): void {
    this.reporter.sendTelemetryEvent(action, data);
  }

  static reportWebviewError(error: Record<string, string>): void {
    this.reporter.sendTelemetryErrorEvent('webview_error', {
      'appmap.webview.error.message': error.message,
      'appmap.webview.error.stack': error.stack,
    });
  }

  static reportOpenUri(uri: vscode.Uri): void {
    this.reporter.sendTelemetryEvent('open_uri', { uri: uri.toString() });
  }
}
