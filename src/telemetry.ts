import * as vscode from 'vscode';
import TelemetryReporter from 'vscode-extension-telemetry';
import { version, publisher, name } from '../package.json';
import { getStringRecords } from './util';
import { basename } from 'path';

const EXTENSION_ID = `${publisher}.${name}`;
const EXTENSION_VERSION = `${version}`;

// This key is meant to be publically shared. However, I'm adding a simple
// obfuscation to mitigate key scraping bots on GitHub. The key is split on
// hypens and base64 encoded without padding.
// key.split('-').map((x) => x.toString('base64').replace(/=*/, ''))
const INSTRUMENTATION_KEY = ['NTBjMWE1YzI', 'NDliNA', 'NDkxMw', 'YjdjYw', 'ODZhNzhkNDA3NDVm']
  .map((x) => Buffer.from(x, 'base64').toString('utf8'))
  .join('-');

class AppMapTelemetry {
  private reporter = new TelemetryReporter(EXTENSION_ID, EXTENSION_VERSION, INSTRUMENTATION_KEY);
  private readonly referenceInfo = {
    'pom.xml': {
      language: 'java',
      framework: 'maven',
    },
    'build.gradle': {
      language: 'java',
      framework: 'gradle',
    },
    'Gemfile.lock': {
      language: 'ruby',
    },
    'pyproject.toml': {
      language: 'python',
    },
    'requirements.txt': {
      language: 'python',
    },
  };

  register(context: vscode.ExtensionContext) {
    context.subscriptions.push(this.reporter);
  }

  async reportStartUp() {
    const languages: string[] = [];
    const frameworks: string[] = [];
    const referenceSources = Object.keys(this.referenceInfo);
    const filesContainingReferences = (
      await Promise.all(
        referenceSources.flatMap(async (fileName) => {
          const files = await vscode.workspace.findFiles(`**/${fileName}`);
          return files.filter(async (uri) => {
            const textDocument = await vscode.workspace.openTextDocument(uri);

            // TODO:
            // This needs to be a little bit smarter.
            return textDocument.getText().includes('appmap');
          });
        })
      )
    ).flat();

    filesContainingReferences
      .map((uri) => {
        const fileBaseName = basename(uri.fsPath);
        return this.referenceInfo[fileBaseName] as Record<string, string>;
      })
      .forEach((m) => {
        if (m.language) {
          languages.push(m.language);
        }

        if (m.framework) {
          // TODO:
          // This needs to be a little bit smarter. Check for supported frameworks (rails, django, etc).
          frameworks.push(m.framework);
        }
      });

    this.reporter.sendTelemetryEvent('initialize', {
      references: String(filesContainingReferences.length > 0),
      languages: languages.join(','),
      frameworks: frameworks.join(','),
    });
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

  reportOpenUri(uri: vscode.Uri) {
    this.reporter.sendTelemetryEvent('open_uri', { uri: uri.toString() });
  }
}

const Telemetry = new AppMapTelemetry();
export default Telemetry;
