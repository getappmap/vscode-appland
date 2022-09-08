import * as http from 'http';
import { AddressInfo } from 'net';
import * as vscode from 'vscode';
import { LiveRecordingTreeDataProvider } from '../tree/liveRecordingTreeDataProvider';

export default class LiveRemoteRecordingService implements vscode.Disposable {
  protected server?: http.Server;

  constructor(protected readonly liveAppMaps: LiveRecordingTreeDataProvider) {}

  async start(context: vscode.ExtensionContext): Promise<void> {
    let desiredPort: number | undefined;
    const portVariable = context.environmentVariableCollection.get('APPMAP_SERVICE_PORT');
    if (portVariable) {
      desiredPort = Number(portVariable.value);
    }

    this.server = http
      .createServer((req, res) => {
        switch (`${req.method?.toUpperCase()} ${req.url?.toLowerCase()}`) {
          case 'POST /appmaps': {
            let body = '';
            req.on('data', (chunk) => (body += chunk));
            req.on('end', () => {
              res.statusCode = 200;
              res.end();

              this.liveAppMaps.addAppMap(body);
            });
            break;
          }

          default: {
            res.statusCode = 404;
            res.end();
          }
        }
      })
      .listen(desiredPort);

    const port = (this.server.address() as AddressInfo | null)?.port?.toString();
    if (!port) {
      console.warn(`Failed to bind the AppMap recording service to a port`);
      return;
    }

    context.environmentVariableCollection.replace('APPMAP_SERVICE_PORT', port);
    context.environmentVariableCollection.replace('APPMAP_SERVICE_URL', `http://localhost:${port}`);
    context.environmentVariableCollection.replace('APPMAP', 'true');
    context.environmentVariableCollection.persistent = true;
  }

  dispose(): void {
    this.server?.close();
  }
}
