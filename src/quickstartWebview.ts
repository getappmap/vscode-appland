import { PathLike } from 'fs';
import path from 'path';
import * as vscode from 'vscode';
import AppMapCollectionFile from './appmapCollectionFile';
import ProjectWatcher from './projectWatcher';
import { getNonce } from './util';

interface AppMapListItem {
  path: PathLike;
  name?: string;
  requests?: number;
  sqlQueries?: number;
  functions?: number;
}

function listAppMaps(
  appmaps: AppMapCollectionFile,
  workspaceFolder: vscode.WorkspaceFolder
): AppMapListItem[] {
  return appmaps.allAppMapsForWorkspaceFolder(workspaceFolder).map(({ descriptor }) => ({
    path: descriptor.resourceUri.fsPath,
    name: descriptor.metadata?.name as string,
    requests: descriptor.numRequests,
    sqlQueries: descriptor.numQueries,
    functions: descriptor.numFunctions,
  }));
}

export default class QuickstartWebview {
  public static readonly viewType = 'appmap.views.quickstart';
  public static readonly command = 'appmap.openQuickstart';

  // Keyed by project root directory
  private static readonly openWebviews = new Map<string, vscode.WebviewPanel>();

  public static register(
    context: vscode.ExtensionContext,
    projects: readonly ProjectWatcher[],
    appmaps: AppMapCollectionFile
  ): void {
    const project = projects[0];
    if (!project) {
      // No project, so no quickstart
      return;
    }

    context.subscriptions.push(
      vscode.commands.registerCommand(this.command, (milestoneIndex?: string) => {
        // Attempt to re-use an existing webview for this project if one exists
        const existingPanel: vscode.WebviewPanel = this.openWebviews[
          project.rootDirectory as string
        ];
        if (existingPanel) {
          existingPanel.reveal(vscode.ViewColumn.One);

          if (milestoneIndex) {
            existingPanel.webview.postMessage({ type: 'changeMilestone', milestoneIndex });
          }

          return;
        }

        let title = 'AppMap: Quickstart';
        if (projects.length > 1) {
          title += ` (${project.workspaceFolder.name})`;
        }

        const panel = vscode.window.createWebviewPanel(
          this.viewType,
          title,
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

        const eventListener = project.onAppMapCreated(() => {
          // TODO.
          // This could be made a lot more efficient by only sending the list item that's new, not the entire snapshot.
          // This also won't be triggered if AppMaps are deleted (BUG).
          panel.webview.postMessage({
            type: 'appmapSnapshot',
            appmaps: listAppMaps(appmaps, project.workspaceFolder),
          });
        });

        panel.onDidDispose(() => {
          eventListener.dispose();
        });

        panel.webview.onDidReceiveMessage(async (message) => {
          switch (message.command) {
            case 'preInitialize':
              {
                // The webview has been created but may not be ready to receive all messages yet.
                panel.webview.postMessage({
                  type: 'init',
                  language: project.language,
                  testFrameworks: project.testFrameworks,
                  initialStep: milestoneIndex,
                  appmapYmlSnippet: await project.appmapYml(),
                  appmaps: listAppMaps(appmaps, project.workspaceFolder),
                  steps: Object.values(project.milestones).map((m) => ({
                    state: m.state,
                    errors: [],
                  })),
                });
              }
              break;

            case 'postInitialize':
              // Listen for state changes on each milestone
              Object.values(project.milestones).forEach(({ onChangeState }, index) => {
                onChangeState(({ id, state }) => {
                  panel.webview.postMessage({ type: 'milestoneUpdate', id, state, index });
                });
              });

              project.milestones.INSTALL_AGENT.onChangeState(async ({ state }) => {
                if (state === 'complete') {
                  panel.webview.postMessage({
                    type: 'agentInfo',
                    testFrameworks: project.testFrameworks,
                    appmapYmlSnippet: await project.appmapYml(),
                  });
                }
              });

              panel.webview.postMessage({
                type: 'milestoneSnapshot',
                steps: Object.values(project.milestones).map((m) => ({
                  state: m.state,
                  errors: [],
                })),
              });
              break;

            case 'milestoneAction':
              {
                // The webview is requesting a milestone action be performed
                const { milestone, language, data } = message.data;

                try {
                  if (language !== project.language) {
                    project.language = language;
                  }

                  await projects[0].performMilestoneAction(milestone, data);
                  panel.webview.postMessage({ type: message.command });
                } catch (e) {
                  panel.webview.postMessage({
                    type: message.command,
                    error: e.message,
                  });
                }
              }
              break;

            case 'openFile':
              {
                const { file } = message;
                let filePath = file;

                if (!path.isAbsolute(file)) {
                  // If the file is not absolute, it's relative to the workspace folder
                  filePath = path.join(project.rootDirectory as string, file);
                }

                vscode.commands.executeCommand('vscode.open', vscode.Uri.file(filePath));
              }
              break;

            case 'focus':
              vscode.commands.executeCommand('appmap.focus');
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
