import * as vscode from 'vscode';
import TelemetryReporter from 'vscode-extension-telemetry';
import { version, publisher, name } from '../package.json';
import { getStringRecords } from './util';

const EXTENSION_ID = `${publisher}.${name}`;
const EXTENSION_VERSION = `${version}`;

// This key is meant to be publically shared. However, I'm adding a simple
// obfuscation to mitigate key scraping bots on GitHub. The key is split on
// hypens and base64 encoded without padding.
// key.split('-').map((x) => x.toString('base64').replace(/=*/, ''))
const INSTRUMENTATION_KEY = [
  'OTE5Y2Q5M2Y',
  'NWE0YQ',
  'NDAyOA',
  'OTEyOQ',
  'ODEzZjI3ZjlhNTFi',
]
  .map((x) => Buffer.from(x, 'base64').toString('utf8'))
  .join('-');

class AppMapTelemetry {
  private reporter = new TelemetryReporter(
    EXTENSION_ID,
    EXTENSION_VERSION,
    INSTRUMENTATION_KEY
  );

  register(context: vscode.ExtensionContext) {
    context.subscriptions.push(this.reporter);
  }

  reportLoadAppMap(metadata: Record<string, any>) {
    const data = {
      ...getStringRecords(metadata.language || {}, 'appmap.language'),
      ...getStringRecords(metadata.client || {}, 'appmap.client'),
      ...getStringRecords(metadata.frameworks || {}, 'appmap.frameworks'),
      'appmap.num_events': metadata.numEvents.toString(),
      'appmap.num_http_events': metadata.numHttpEvents.toString(),
      'appmap.num_sql_events': metadata.numSqlEvents.toString(),
    } as Record<string, string>;

    if (Array.isArray(metadata?.frameworks)) {
      metadata.frameworks.forEach((framework) => {
        data[`appmap.frameworks.${framework.name}`] = framework.version;
      });
    }

    if (metadata?.git?.url) {
      data['appmap.git'] = String(metadata.git.url)
        .replace(/.*(@|:\/\/)/, '') // Drop basic authentication and/or protocols
        .replace(/\/?\.git$/, '') //   Drop git extensions
        .replace(/:/gm, '/'); //       Make any remaining scope pathlike
      //                               i.e. github.com:myorg/myrepo ->
      //                                    github.com/myorg/myrepo
    }

    const metrics = { 'appmap.load_time': metadata.loadTime };

    this.reporter.sendTelemetryEvent('open', data, metrics);
  }

  reportAction(action: string, data: Record<string, string> | undefined) {
    this.reporter.sendTelemetryEvent(action, data);
  }

  reportWebviewError(error: Record<string, string>) {
    this.reporter.sendTelemetryErrorEvent('webview_error', {
      'appmap.webview.error.message': error.message,
      'appmap.webview.error.stack': error.stack,
    });
  }
}

const Telemetry = new AppMapTelemetry();
export default Telemetry;
