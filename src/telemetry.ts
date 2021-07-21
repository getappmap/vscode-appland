import * as vscode from 'vscode';
import TelemetryReporter from 'vscode-extension-telemetry';
import { version, publisher, name } from '../package.json';
import TelemetryResolver, { EventContext } from './telemetry/telemetryResolver';
import { Properties } from './telemetry/index';
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
  DEBUG_EXCEPTION: {
    eventName: 'debug/exception',
    properties: [Properties.Debug.EXCEPTION],
  },
  PROJECT_OPEN: {
    eventName: 'project:open',
    properties: [
      Properties.Project.AGENT_VERSION,
      Properties.Project.IS_CONFIG_PRESENT,
      Properties.Project.LANGUAGE,
      Properties.Project.LANGUAGE_DISTRIBUTION,
    ],
    // metrics: [Metrics.Project.EXAMPLE],
  },
  PROJECT_CLIENT_AGENT_ADD: {
    eventName: 'project/client_agent:add',
    properties: [Properties.Project.AGENT_VERSION, Properties.Project.LANGUAGE],
  },
  PROJECT_CLIENT_AGENT_REMOVE: {
    eventName: 'project/client_agent:remove',
    properties: [],
  },
  PROJECT_CONFIG_WRITE: {
    eventName: 'project/config:write',
    properties: [],
  },
  MILESTONE_CHANGE_STATE: {
    eventName: 'milestone:change_state',
    properties: [Properties.Milestones.ID, Properties.Milestones.STATE],
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
  private static debugChannel?: vscode.OutputChannel;

  static register(context: vscode.ExtensionContext): void {
    context.subscriptions.push(this.reporter);

    if (process.env.APPMAP_TELEMETRY_DEBUG) {
      this.debugChannel = vscode.window.createOutputChannel('AppMap: Telemetry');
    }
  }

  static async sendEvent(event: Event, eventContext: EventContext): Promise<void> {
    const telemetry = new TelemetryResolver(eventContext);
    let properties: Record<string, string> | undefined;
    let metrics: Record<string, number> | undefined;

    if (event.properties) {
      properties = await telemetry.resolve(...event.properties);
    }

    if (event.metrics) {
      metrics = await telemetry.resolve(...event.metrics);
    }

    this.debugChannel?.appendLine(
      JSON.stringify(
        {
          event: `${EXTENSION_ID}/${event.eventName}`,
          properties,
          metrics,
        },
        null,
        2
      )
    );

    this.reporter.sendTelemetryEvent(event.eventName, properties, metrics);
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
