import path from 'path';
import * as vscode from 'vscode';
import ProjectWatcher from './projectWatcher';
import { getNonce } from './util';

export default class QuickstartWebview {
  public static readonly viewType = 'appmap.views.quickstart';
  public static readonly command = 'appmap.openQuickstart';

  public static register(
    context: vscode.ExtensionContext,
    projects: readonly ProjectWatcher[]
  ): void {
    const project = projects[0];
    if (!project) {
      // No project, so no quickstart
      return;
    }

    context.subscriptions.push(
      vscode.commands.registerCommand(this.command, () => {
        const panel = vscode.window.createWebviewPanel(
          this.viewType,
          'AppMap: Quickstart',
          vscode.ViewColumn.One,
          {
            enableScripts: true,
            retainContextWhenHidden: true,
          }
        );

        panel.webview.html = getWebviewContent(panel.webview, context);

        panel.webview.onDidReceiveMessage(async (message) => {
          switch (message.command) {
            case 'ready':
              {
                // The webview has been created and is ready to receive messages
                panel.webview.postMessage({
                  type: 'init',
                  language: project.language,
                  completedSteps: Object.values(project.milestones)
                    .map((m, i) => (m.state === 'complete' ? i + 1 : null))
                    .filter(Boolean),
                });
              }
              break;

            case 'milestoneAction':
              {
                // The webview is requesting a milestone action be performed
                const { milestone, language } = message.data;

                try {
                  if (language !== project.language) {
                    project.language = language;
                  }

                  await projects[0].performMilestoneAction(milestone);
                  panel.webview.postMessage({ type: message.command });
                } catch (e) {
                  panel.webview.postMessage({
                    type: message.command,
                    error: e.message,
                  });
                }
              }
              break;

            default:
              break;
          }
        });
      })
    );
  }
}

function getWebviewContent(webview: vscode.Webview, context: vscode.ExtensionContext): string {
  const scriptUri = webview.asWebviewUri(
    vscode.Uri.file(path.join(context.extensionPath, 'out', 'app.js'))
  );
  const nonce = getNonce();

  return ` <!DOCTYPE html>
  <html lang="en">
  <head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">

    <title>AppLand Scenario</title>
  </head>
  <body>
    <div id="app">
    </div>
    <script nonce="${nonce}" src="${scriptUri}"></script>
    <script type="text/javascript" nonce="${nonce}">
      AppLandWeb.mountQuickstart();
    </script>
  </body>
  </html>`;
}
