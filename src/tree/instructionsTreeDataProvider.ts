import * as vscode from 'vscode';
import * as path from 'path';
import svgPending from '../../web/static/media/tree/pending.svg';
import extensionSettings from '../configuration/extensionSettings';
import { ProjectStateServiceInstance } from '../services/projectStateService';

interface DocPage {
  id: string;
  title: string;
  command: string;
  isComplete?: (p: ProjectStateServiceInstance) => Promise<boolean> | boolean;
  args?: unknown[];
}

const docsPages: DocPage[] = [
  {
    id: 'WALKTHROUGH_PROJECT_PICKER',
    title: 'Install AppMap agent',
    command: 'appmap.openInstallGuide',
    async isComplete(projectState: ProjectStateServiceInstance): Promise<boolean> {
      return Boolean((await projectState.metadata()).agentInstalled);
    },
    args: ['project-picker'],
  },
  {
    id: 'WALKTHROUGH_RECORD_APPMAPS',
    title: 'Record AppMaps',
    command: 'appmap.openInstallGuide',
    async isComplete(projectState: ProjectStateServiceInstance): Promise<boolean> {
      return Boolean((await projectState.metadata()).appMapsRecorded);
    },
    args: ['record-appmaps'],
  },
  {
    id: 'GETTING_STARTED_OPEN_APPMAPS',
    title: 'Explore AppMaps',
    command: 'appmap.openInstallGuide',
    async isComplete(projectState: ProjectStateServiceInstance): Promise<boolean> {
      return Boolean((await projectState.metadata()).appMapOpened);
    },
    args: ['open-appmaps'],
  },
  {
    id: 'WALKTHROUGH_GENERATE_OPENAPI',
    title: 'Generate OpenAPI definitions',
    command: 'appmap.openInstallGuide',
    async isComplete(projectState: ProjectStateServiceInstance): Promise<boolean> {
      return Boolean((await projectState.metadata()).generatedOpenApi);
    },
    args: ['openapi'],
  },
  {
    id: 'WALKTHROUGH_INVESTIGATE_FINDINGS',
    title: 'Runtime Analysis',
    command: 'appmap.openInstallGuide',
    async isComplete(projectState: ProjectStateServiceInstance): Promise<boolean> {
      return Boolean((await projectState.metadata()).investigatedFindings);
    },
    args: ['investigate-findings'],
  },
];

async function getIcon(
  page: DocPage,
  projectState?: ProjectStateServiceInstance
): Promise<string | vscode.ThemeIcon> {
  if (!extensionSettings.findingsEnabled() && page.id === 'WALKTHROUGH_INVESTIGATE_FINDINGS') {
    return new vscode.ThemeIcon('lock');
  }

  if (!projectState || !page.isComplete) {
    return new vscode.ThemeIcon('circle-large-outline');
  }

  return (await page.isComplete(projectState))
    ? new vscode.ThemeIcon('pass-filled', new vscode.ThemeColor('terminal.ansiGreen'))
    : path.join(__dirname, svgPending);
}

export class InstructionsTreeDataProvider implements vscode.TreeDataProvider<vscode.TreeItem> {
  private _onDidChangeTreeData: vscode.EventEmitter<
    vscode.TreeItem | undefined | null | void
  > = new vscode.EventEmitter<vscode.TreeItem | undefined | null | void>();
  public readonly onDidChangeTreeData: vscode.Event<
    vscode.TreeItem | undefined | null | void
  > = this._onDidChangeTreeData.event;
  public items: vscode.TreeItem[] = [];

  constructor(
    context: vscode.ExtensionContext,
    protected readonly projectStates: ProjectStateServiceInstance[]
  ) {
    this.update();
    if (this.projectState) {
      context.subscriptions.push(this.projectState.onStateChange(() => this.update()));
    }
  }

  private async update(): Promise<void> {
    this.items = await this.buildItems();
    this._onDidChangeTreeData.fire();
  }

  private async buildItems(): Promise<vscode.TreeItem[]> {
    return Promise.all(
      docsPages.map(async (page) => {
        const treeItem = new vscode.TreeItem(page.title);
        treeItem.id = page.id as string;
        treeItem.command = {
          command: page.command,
          arguments: page.args,
        } as vscode.Command;

        treeItem.iconPath = await getIcon(page, this.projectState);

        return treeItem;
      })
    );
  }

  // Return the properties for the current project if only one exists in the workspace
  private get projectState(): ProjectStateServiceInstance | undefined {
    if (this.projectStates.length === 1) {
      return this.projectStates[0];
    }
  }

  public getTreeItem(element: vscode.TreeItem): vscode.TreeItem {
    return element;
  }

  public getParent(): Thenable<vscode.TreeItem | null> {
    return Promise.resolve(null);
  }

  public getChildren(): Thenable<vscode.TreeItem[]> {
    return Promise.resolve(this.items);
  }
}
