import * as vscode from 'vscode';
import TelemetryReporter from 'vscode-extension-telemetry';
import { version, publisher, name } from '../../package.json';
import ExtensionSettings from '../configuration/extensionSettings';
import { UnionToIntersection } from '../util';
import TelemetryResolver from './telemetryResolver';
import TelemetryDataProvider from './telemetryDataProvider';
import Event from './event';
import SplunkTelemetryReporter from './splunkTelemetryReporter';
import os from 'os';

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

type Reporter = Pick<
  TelemetryReporter,
  'sendTelemetryEvent' | 'sendTelemetryErrorEvent' | 'dispose'
> & {
  testConnection?: () => Promise<unknown>;
};

/**
 * The primary interface for sending telemetry data.
 */
export class Telemetry {
  private static reporter: Reporter;
  private static debugChannel?: vscode.OutputChannel;
  private static isSplunk = false;

  static register(context: vscode.ExtensionContext): void {
    if (process.env.APPMAP_TELEMETRY_DEBUG) {
      this.debugChannel = vscode.window.createOutputChannel('AppMap: Telemetry');
    }

    const telemetryConfig = ExtensionSettings.telemetryConfiguration;
    const commonProperties: Record<string, string> = {
      'common.os': os.platform(),
      'common.platformversion': os.release(),
      'common.extname': EXTENSION_ID,
      'common.extversion': EXTENSION_VERSION,
      'common.ide': vscode.env.appName,
      'common.ideversion': vscode.version,
    };

    if (telemetryConfig.backend === 'splunk') {
      this.isSplunk = true;
      const { url, token } = telemetryConfig;
      if (url && token) {
        const splunkProperties: Record<string, string> = {
          ...commonProperties,
        };
        try {
          splunkProperties['common.username'] = os.userInfo().username;
        } catch (e) {
          // ignore
        }
        this.reporter = new SplunkTelemetryReporter(
          url,
          token,
          splunkProperties,
          telemetryConfig.ca
        );
        void this.testConnection();
        if (this.debugChannel) {
          this.debugChannel.appendLine('Using Splunk telemetry reporter at ' + url);
        }
      } else {
        if (this.debugChannel) {
          this.debugChannel.appendLine('Splunk telemetry reporter is not configured properly.');
        }
        // Don't send telemetry if Splunk is configured but the URL or token are missing.
        this.reporter = NOOP_TELEMETRY;
      }
    } else {
      this.reporter = new TelemetryReporter(EXTENSION_ID, EXTENSION_VERSION, INSTRUMENTATION_KEY);
    }

    context.subscriptions.push(this.reporter);
  }

  private static async testConnection(): Promise<void> {
    if (this.reporter.testConnection) {
      try {
        await this.reporter.testConnection();
        this.debugChannel?.appendLine('Successfully connected to Splunk telemetry endpoint.');
      } catch (e) {
        this.debugChannel?.appendLine('Error connecting to Splunk telemetry endpoint: ' + e);
        let errorMessage =
          'Could not connect to telemetry endpoint. Telemetry will not work. \n\n' + e;
        if (e instanceof Error && e.message.includes('cert')) {
          errorMessage += "\n\nTry setting http.proxySupport to 'fallback' in VSCode settings.";
        }
        vscode.window.showErrorMessage(errorMessage);
      }
    }
  }

  static async sendEvent<PropertyType, MetricType>(
    event: Event<PropertyType, MetricType>,
    data?: UnionToIntersection<DataType<PropertyType>> & UnionToIntersection<DataType<MetricType>>
  ): Promise<void> {
    const telemetry = new TelemetryResolver((data || {}) as Record<string, unknown>);
    let properties: Record<string, string> | undefined;
    let metrics: Record<string, number> | undefined;

    if (event.properties) {
      properties = await telemetry.resolve(
        ...(event.properties as unknown as DataResolverArray<string>)
      );
    }

    if (event.metrics) {
      metrics = await telemetry.resolve(...(event.metrics as unknown as DataResolverArray<number>));
    }

    if (!this.isSplunk) {
      properties = {
        ...properties,
        // Add common properties when using Application Insights
        // (others are added automatically by the AI SDK).
        'common.ide': vscode.env.appName,
        'common.ideversion': vscode.version,
      };
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

const NOOP_TELEMETRY: Reporter = {
  sendTelemetryEvent(): void {
    /* no-op */
  },
  sendTelemetryErrorEvent(): void {
    /* no-op */
  },
  dispose(): Promise<void> {
    return Promise.resolve();
  },
};

export * from './definitions/events';
