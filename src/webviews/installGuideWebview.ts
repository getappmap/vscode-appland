import * as vscode from 'vscode';
import { InstallAgent } from '../commands/installAgent';
import { ProjectStateServiceInstance } from '../services/projectStateService';
import AnalysisManager from '../services/analysisManager';
import { AUTHN_PROVIDER_NAME } from '../authentication';
import getWebviewContent from './getWebviewContent';

export default class InstallGuideWebView {
  public static readonly viewType = 'appmap.views.installGuide';
  public static readonly command = 'appmap.openInstallGuide';
  private static existingPanel?: vscode.WebviewPanel;

  public static register(
    context: vscode.ExtensionContext,
    projectStates: ProjectStateServiceInstance[]
  ): void {
    context.subscriptions.push(
      vscode.commands.registerCommand(this.command, async (focusCommand?: string) => {
        // Short circuit if no project is open. The project picker has the correct prompts
        // to handle this case.

        // Attempt to re-use an existing webview for this project if one exists
        if (this.existingPanel) {
          this.existingPanel.reveal(vscode.ViewColumn.One);
          this.existingPanel.webview.postMessage({
            type: 'page',
            focusCommand,
          });
          return;
        }

        const panel = vscode.window.createWebviewPanel(
          this.viewType,
          'Recording AppMap data',
          vscode.ViewColumn.One,
          {
            enableScripts: true,
            retainContextWhenHidden: true,
          }
        );

        this.existingPanel = panel;

        panel.webview.html = getWebviewContent(
          panel.webview,
          context,
          'Recording AppMap data',
          'install-guide'
        );

        const collectProjects = () => projectStates.map((project) => project.metadata);
        const disposables = projectStates.map((projectState) =>
          projectState.onStateChange(() => {
            panel.webview.postMessage({
              type: 'projects',
              projects: collectProjects(),
            });
          })
        );

        disposables.push(
          AnalysisManager.onAnalysisToggled((e) => {
            panel.webview.postMessage({
              type: 'analysis-toggle',
              ...e,
            });
          }),
          vscode.authentication.onDidChangeSessions(async (e) => {
            if (e.provider.id !== AUTHN_PROVIDER_NAME) return;
            panel.webview.postMessage({
              type: 'user-authenticated',
              userAuthenticated: await AnalysisManager.isUserAuthenticated(),
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
            case 'ready': {
              const isUserAuthenticated = await AnalysisManager.isUserAuthenticated();
              panel.webview.postMessage({
                type: 'init',
                projects: collectProjects(),
                userAuthenticated: isUserAuthenticated,
                debugConfigurationStatus: 1,
              });

              break;
            }

            case 'clipboard':
              break;

            case 'view-problems':
              {
                vscode.commands.executeCommand('workbench.panel.markers.view.focus');
              }
              break;

            case 'perform-install':
              {
                const { path, language } = message as { path: string; language: string };
                vscode.commands.executeCommand(InstallAgent, path, language);
              }
              break;

            case 'open-navie':
              vscode.commands.executeCommand('appmap.explain');
              break;

            case 'submit-to-navie':
              {
                const { suggestion } = message as {
                  suggestion: { label: string; prompt: string };
                };
                vscode.commands.executeCommand('appmap.explain', { suggestion });
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
