import * as path from 'path';
import * as vscode from 'vscode';
import extensionSettings from '../configuration/extensionSettings';
import { ProjectStateServiceInstance } from '../services/projectStateService';
import { COPY_COMMAND, OPEN_VIEW, Telemetry } from '../telemetry';
import { getNonce } from '../util';
import ProjectMetadata from '../workspace/projectMetadata';
import * as semver from 'semver';
import ExtensionState from '../configuration/extensionState';

type PageMessage = {
  page: string;
  project?: ProjectMetadata;
};

type ClipboardMessage = {
  text: string;
} & PageMessage;

export default class InstallGuideWebView {
  public static readonly viewType = 'appmap.views.installGuide';
  public static readonly command = 'appmap.openInstallGuide';
  private static existingPanel?: vscode.WebviewPanel;

  public static tryOpen(extensionState: ExtensionState): Thenable<void | undefined> | undefined {
    const firstVersionInstalled = semver.coerce(extensionState.firstVersionInstalled);
    if (firstVersionInstalled && semver.gte(firstVersionInstalled, '0.15.0')) {
      // Logic within this block will only be executed if the extension was installed after we began tracking the
      // time of installation. We will use this to determine whether or not our UX improvements are effective, without
      // before rolling them out to our existing user base.

      if (!extensionState.hasViewedInstallGuide) {
        extensionState.hasViewedInstallGuide = true;
        return vscode.commands.executeCommand('appmap.openInstallGuide', 'project-picker');
      }
    }
  }

  public static register(
    context: vscode.ExtensionContext,
    projectStates: ProjectStateServiceInstance[]
  ): void {
    context.subscriptions.push(
      vscode.commands.registerCommand(this.command, async (pageIndex: number) => {
        // Attempt to re-use an existing webview for this project if one exists
        if (this.existingPanel) {
          this.existingPanel.reveal(vscode.ViewColumn.One);
          this.existingPanel.webview.postMessage({
            type: 'page',
            page: pageIndex,
          });
          return;
        }

        const panel = vscode.window.createWebviewPanel(
          this.viewType,
          'Using AppMap',
          vscode.ViewColumn.One,
          {
            enableScripts: true,
            retainContextWhenHidden: true,
          }
        );

        this.existingPanel = panel;

        panel.webview.html = getWebviewContent(panel.webview, context);

        const collectProjects = async (): Promise<Readonly<ProjectMetadata>[]> =>
          await Promise.all(projectStates.map(async (project) => project.metadata()));

        const disposables = projectStates.map((projectState) =>
          projectState.onStateChange(async () => {
            panel.webview.postMessage({
              type: 'projects',
              projects: await collectProjects(),
            });
          })
        );

        // If the user closes the panel, make sure it's no longer cached
        panel.onDidDispose(() => {
          this.existingPanel = undefined;
          disposables.forEach((disposable) => disposable.dispose());
        });

        panel.webview.onDidReceiveMessage(async (message) => {
          switch (message.command) {
            case 'ready':
              panel.webview.postMessage({
                type: 'init',
                projects: await collectProjects(),
                disabled: extensionSettings.findingsEnabled() ? [] : ['investigate-findings'],
                page: pageIndex,
              });

              break;

            case 'open-file':
              vscode.commands.executeCommand('vscode.open', vscode.Uri.file(message.file));
              break;

            case 'open-page':
              {
                const { page, project } = message as PageMessage;
                Telemetry.sendEvent(OPEN_VIEW, { viewId: page, rootDirectory: project?.path });
              }
              break;

            case 'clipboard':
              {
                const { page, project, text } = message as ClipboardMessage;
                Telemetry.sendEvent(COPY_COMMAND, {
                  viewId: page,
                  text: text,
                  rootDirectory: project?.path,
                });
              }
              break;

            case 'view-problems':
              vscode.commands.executeCommand('workbench.panel.markers.view.focus');
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
      AppLandWeb.mountInstallGuide();
    </script>1
  </body>
  </html>`;
}
