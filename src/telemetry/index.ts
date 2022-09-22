import * as vscode from 'vscode';
import TelemetryReporter from 'vscode-extension-telemetry';
import { version, publisher, name } from '../../package.json';
import { UnionToIntersection } from '../util';
import TelemetryResolver from './telemetryResolver';
import TelemetryDataProvider from './telemetryDataProvider';
import Event from './event';
export * from './sendAppMapCreateEvent';

const EXTENSION_ID = `${publisher}.${name}`;
const EXTENSION_VERSION = `${version}`;

// This key is meant to be publically shared. However, I'm adding a simple
// obfuscation to mitigate key scraping bots on GitHub. The key is split on
// hypens and base64 encoded without padding.
// key.split('-').map((x) => x.toString('base64').replace(/=*/, ''))
const INSTRUMENTATION_KEY = ['NTBjMWE1YzI', 'NDliNA', 'NDkxMw', 'YjdjYw', 'ODZhNzhkNDA3NDVm']
  .map((x) => Buffer.from(x, 'base64').toString('utf8'))
  .join('-');

// Retrieve the generic data type used by a TelemetryDataProvider array.
type DataType<T> = T extends Array<TelemetryDataProvider<infer P, unknown>> ? P : unknown;
type DataResolverArray<T> = TelemetryDataProvider<Record<string, unknown>, T>[];

/**
 * The primary interface for sending telemetry data.
 */
export class Telemetry {
  private static reporter = new TelemetryReporter(
    EXTENSION_ID,
    EXTENSION_VERSION,
    INSTRUMENTATION_KEY
  );
  private static debugChannel?: vscode.OutputChannel;

  static register(context: vscode.ExtensionContext): void {
    context.subscriptions.push(this.reporter);

    if (process.env.APPMAP_TELEMETRY_DEBUG) {
      this.debugChannel = vscode.window.createOutputChannel('AppMap: Telemetry');
    }
  }

  static async sendEvent<PropertyType, MetricType>(
    event: Event<PropertyType, MetricType>,
    data: UnionToIntersection<DataType<PropertyType>> & UnionToIntersection<DataType<MetricType>>
  ): Promise<void> {
    const telemetry = new TelemetryResolver(data as Record<string, unknown>);
    let properties: Record<string, string> | undefined;
    let metrics: Record<string, number> | undefined;

    if (event.properties) {
      properties = await telemetry.resolve(
        ...((event.properties as unknown) as DataResolverArray<string>)
      );
    }

    if (event.metrics) {
      metrics = await telemetry.resolve(
        ...((event.metrics as unknown) as DataResolverArray<number>)
      );
    }

    this.debugChannel?.appendLine(
      JSON.stringify(
        {
          event: `${EXTENSION_ID}/${event.name}`,
          properties,
          metrics,
        },
        null,
        2
      )
    );

    this.reporter.sendTelemetryEvent(event.name, properties, metrics);
  }

  static reportAction(action: string, data?: Record<string, string>): void {
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

export * from './definitions/events';
