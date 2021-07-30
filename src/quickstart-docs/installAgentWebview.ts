import * as path from 'path';
import * as vscode from 'vscode';
import * as semver from 'semver';
import AppMapProperties from '../appmapProperties';
import ProjectWatcher from '../projectWatcher';
import { getNonce } from '../util';

const supportedLanguages = [
  {
    id: 'ruby',
    name: 'Ruby',
    link: 'https://appland.com/docs/quickstart/vscode/ruby-step-2.html',
    isDetected: false,
  },
  {
    id: 'python',
    name: 'Python',
    link: 'https://appland.com/docs/quickstart/vscode/python-step-2.html',
    isDetected: false,
  },
  {
    id: 'java',
    name: 'Java',
    link: 'https://appland.com/docs/quickstart/vscode/java-step-2.html',
    isDetected: false,
  },
];

export default class QuickstartDocsInstallAgent {
  public static readonly viewType = 'appmap.views.quickstart';
  public static readonly command = 'appmap.openQuickstartDocsInstallAgent';

  // Keyed by project root directory
  private static readonly openWebviews = new Map<string, vscode.WebviewPanel>();

  public static async register(
    context: vscode.ExtensionContext,
    properties: AppMapProperties,
    projects: readonly ProjectWatcher[]
  ): Promise<void> {
    const project = projects[0];
    if (!project) {
      // No project, so no quickstart
      return;
    }

    context.subscriptions.push(
      vscode.commands.registerCommand(this.command, () => {
        // Attempt to re-use an existing webview for this project if one exists
        const existingPanel: vscode.WebviewPanel = this.openWebviews[
          project.rootDirectory as string
        ];
        if (existingPanel) {
          existingPanel.reveal(vscode.ViewColumn.One);
          return;
        }

        const panel = vscode.window.createWebviewPanel(
          this.viewType,
          'Quickstart: Install Appmap Agent',
          vscode.ViewColumn.One,
          {
            enableScripts: true,
            retainContextWhenHidden: true,
          }
        );

        // Cache this panel so we can reuse it later if the user clicks another quickstart milestone from the tree view
        this.openWebviews[project.rootDirectory as string] = panel;

        // If the user closes the panel, make sure it's no longer cached
        panel.onDidDispose(() => {
          delete this.openWebviews[project.rootDirectory as string];
        });

        panel.webview.html = getWebviewContent(panel.webview, context);

        panel.webview.onDidReceiveMessage(async (message) => {
          switch (message.command) {
            case 'preInitialize':
              {
                // The webview has been created but may not be ready to receive all messages yet.
                panel.webview.postMessage({
                  type: 'init',
                  languages: supportedLanguages.map((lang) => {
                    if (lang.id === project.language) {
                      lang.isDetected = true;
                    }
                    return lang;
                  }),
                });
              }
              break;
            default:
              break;
          }
        });

        vscode.commands.executeCommand('appmap.focusQuickstartDocs', 0);
        properties.hasSeenQuickStartDocs = true;
      })
    );

    const firstVersionInstalled = semver.coerce(properties.firstVersionInstalled);
    if (firstVersionInstalled && semver.gte(firstVersionInstalled, '0.15.0')) {
      // Logic within this block will only be executed if the extension was installed after we began tracking the
      // time of installation. We will use this to determine whether or not our UX improvements are effective, without
      // before rolling them out to our existing user base.

      if (!properties.hasSeenQuickStartDocs && projects.length == 1) {
        await vscode.commands.executeCommand('appmap.openQuickstartDocsInstallAgent');
      }
    }
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
      AppLandWeb.mountQuickstartInstallAgent();
    </script>
  </body>
  </html>`;
}
