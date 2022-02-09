import * as vscode from 'vscode';
import * as path from 'path';
import ProjectWatcher from '../projectWatcher';
import svgComplete from '../../web/static/media/tree/complete.svg';
import svgIncomplete from '../../web/static/media/tree/incomplete.svg';
import svgError from '../../web/static/media/tree/error.svg';
import QuickstartWebview from '../quickstartWebview';
import Milestone from '../milestones';
import { Telemetry, DEBUG_EXCEPTION } from '../telemetry';

const ICONS = {
  complete: path.join(__dirname, svgComplete),
  incomplete: path.join(__dirname, svgIncomplete),
  error: path.join(__dirname, svgError),
};

export class MilestoneTreeDataProvider implements vscode.TreeDataProvider<vscode.TreeItem> {
  private readonly context: vscode.ExtensionContext;
  private readonly projects: readonly ProjectWatcher[];
  // private readonly milestoneDefinitions: MilestoneDefinitions;
  private _onDidChangeTreeData: vscode.EventEmitter<
    vscode.TreeItem | undefined | null | void
  > = new vscode.EventEmitter<vscode.TreeItem | undefined | null | void>();
  public readonly onDidChangeTreeData: vscode.Event<
    vscode.TreeItem | undefined | null | void
  > = this._onDidChangeTreeData.event;

  constructor(context: vscode.ExtensionContext, projects: readonly ProjectWatcher[]) {
    this.context = context;
    this.projects = projects;

    projects.forEach((project) => {
      Object.values(project.milestones).forEach((milestone) => {
        milestone.onChangeState(() => this.onUpdate());
      });
    });
  }

  static registerCommands(context: vscode.ExtensionContext): void {
    context.subscriptions.push(
      vscode.commands.registerCommand('appmap.clickMilestone', (milestone: Milestone) => {
        try {
          const { milestones } = milestone.project;
          const milestoneIndex =
            Object.values(milestones).findIndex((m: Milestone) => m.id === milestone.id) + 1;

          vscode.commands.executeCommand(QuickstartWebview.command, milestoneIndex);
        } catch (exception) {
          Telemetry.sendEvent(DEBUG_EXCEPTION, { exception: exception as Error });
        }
      })
    );
  }

  public getTreeItem(element: vscode.TreeItem): vscode.TreeItem {
    return element;
  }

  public getParent(): Thenable<vscode.TreeItem | null> {
    return Promise.resolve(null);
  }

  public getChildren(): Thenable<vscode.TreeItem[]> {
    const project = this.projects[0];
    if (!project) {
      return Promise.resolve([]);
    }
    const items = Object.values(project.milestones).map((milestone) => {
      const treeItem = new vscode.TreeItem(milestone.label);
      treeItem.id = milestone.id;
      treeItem.iconPath = ICONS[milestone.state];
      treeItem.command = {
        command: 'appmap.clickMilestone',
        arguments: [milestone],
      } as vscode.Command;

      return treeItem;
    });

    return Promise.resolve(items);
  }

  private onUpdate() {
    this._onDidChangeTreeData.fire();
  }
}
