import * as vscode from 'vscode';
import { InstallAgent } from '../commands/installAgent';
import { ProjectStateServiceInstance } from '../services/projectStateService';
import ProjectMetadata from '../workspace/projectMetadata';
import ExtensionState from '../configuration/extensionState';
import { DocPageId, ProjectPicker, RecordAppMaps } from '../tree/instructionsTreeDataProvider';
import AnalysisManager from '../services/analysisManager';
import { AUTHN_PROVIDER_NAME } from '../authentication';
import getWebviewContent from './getWebviewContent';
import AssetManager, { AssetStatus } from '../services/javaAssets';
import JavaAssets from '../services/javaAssets';
import { workspaceServices } from '../services/workspaceServices';
import { RunConfigService, RunConfigServiceInstance } from '../services/runConfigService';

type PageMessage = {
  page: string;
  project?: ProjectMetadata;
  projects?: ProjectMetadata[];
};

function defaultPageId(projectStates: ProjectStateServiceInstance[]): DocPageId {
  const anyInstalled = projectStates.some((project) => project.metadata.agentInstalled);
  if (!anyInstalled) return ProjectPicker;

  return RecordAppMaps;
}

export default class InstallGuideWebView {
  public static readonly viewType = 'appmap.views.installGuide';
  public static readonly command = 'appmap.openInstallGuide';
  private static existingPanel?: vscode.WebviewPanel;

  public static register(
    context: vscode.ExtensionContext,
    projectStates: ProjectStateServiceInstance[],
    extensionState: ExtensionState
  ): void {
    context.subscriptions.push(
      vscode.commands.registerCommand(this.command, async (page?: DocPageId) => {
        if (!page) page = defaultPageId(projectStates);

        // Attempt to re-use an existing webview for this project if one exists
        if (this.existingPanel) {
          this.existingPanel.reveal(vscode.ViewColumn.One);
          this.existingPanel.webview.postMessage({
            type: 'page',
            page,
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

        panel.webview.html = getWebviewContent(
          panel.webview,
          context,
          'Using AppMap',
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

        let isJavaAgentDownloaded = await JavaAssets.assetsExist();
        if (!isJavaAgentDownloaded) {
          disposables.push(
            AssetManager.onStatusChanged((newStatus) => {
              if (newStatus === AssetStatus.UpToDate) {
                isJavaAgentDownloaded = true;
              }
              panel.webview.postMessage({
                type: 'java-agent-download-status',
                status: newStatus,
              });
            })
          );
        }

        panel.webview.onDidReceiveMessage(async (message) => {
          switch (message.command) {
            case 'ready': {
              const isUserAuthenticated = await AnalysisManager.isUserAuthenticated();
              panel.webview.postMessage({
                type: 'init',
                projects: collectProjects(),
                page,
                analysisEnabled: AnalysisManager.isAnalysisEnabled,
                userAuthenticated: isUserAuthenticated,
                debugConfigurationStatus: 1,
                javaAgentStatus: isJavaAgentDownloaded ? AssetStatus.UpToDate : AssetManager.status,
              });
              break;
            }

            case 'open-file':
              vscode.commands.executeCommand('vscode.open', vscode.Uri.file(message.file));
              break;

            case 'open-page':
              {
                const { page, project } = message as PageMessage;
                if (page === 'open-appmaps') {
                  vscode.commands.executeCommand('appmap.view.focusCodeObjects');
                } else if (page === 'investigate-findings') {
                  if (!project) break;

                  // Make sure all previous steps are completed
                  // before flagging runtime analysis as complete.
                  // Once runtime analysis is complete, the prompt
                  // will say "setup is complete", so we want to make
                  // sure this is completed last.
                  const service = projectStates.find(
                    ({ metadata }) => metadata.path === project?.path
                  );
                  const successConditions = [
                    service?.metadata.agentInstalled,
                    service?.metadata.numAppMaps,
                    service?.metadata.appMapOpened,
                  ];
                  if (!successConditions.every(Boolean)) break;

                  const workspaceFolder = vscode.workspace.getWorkspaceFolder(
                    vscode.Uri.parse(project.path)
                  );
                  if (!workspaceFolder) break;

                  extensionState.setFindingsInvestigated(workspaceFolder, true);
                }
              }
              break;

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

            case 'add-java-configs':
              {
                const { projectPath } = message as { projectPath: string };
                const workspaceFolder = vscode.workspace.getWorkspaceFolder(
                  vscode.Uri.parse(projectPath)
                );
                if (!workspaceFolder) break;

                const serviceInstance: RunConfigServiceInstance | undefined =
                  workspaceServices().getServiceInstanceFromClass(
                    RunConfigService,
                    workspaceFolder
                  );

                serviceInstance?.addMissingConfigs();
              }
              break;

            case 'view-output':
              JavaAssets.showOutput();
              break;

            default:
              break;
          }
        });
      })
    );
  }
}
