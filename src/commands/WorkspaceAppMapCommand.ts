import * as vscode from 'vscode';
import chooseWorkspace from '../lib/chooseWorkspace';
import { join } from 'path';
import { AppmapConfigManager, DEFAULT_APPMAP_DIR } from '../services/appmapConfigManager';
import { default as childProcessRunCommand } from './runCommand';

export class ProjectStructure {
  constructor(public projectDir: string, public appmapDir: string) {}

  path(...args: string[]): string {
    return join(this.projectDir, ...args);
  }

  static async build(workspaceFolder: vscode.WorkspaceFolder): Promise<ProjectStructure> {
    const config = await AppmapConfigManager.getAppMapConfig(workspaceFolder);
    const cwd = config?.configFolder || workspaceFolder.uri.fsPath;
    const appmapDir = config?.appmapDir || DEFAULT_APPMAP_DIR;

    return new ProjectStructure(cwd, appmapDir);
  }
}

export abstract class WorkspaceAppMapCommand {
  constructor(
    protected context: vscode.ExtensionContext,
    protected workspaceFolder: vscode.WorkspaceFolder
  ) {}

  async run(): Promise<boolean> {
    const project = await ProjectStructure.build(this.workspaceFolder);
    if (!project) return false;

    await this.performRequest(project);
    return true;
  }

  protected async runCommand(
    project: ProjectStructure,
    errorCode: number,
    errorMessage: string,
    args: string[]
  ): Promise<boolean> {
    return childProcessRunCommand(this.context, errorCode, errorMessage, args, project.projectDir);
  }

  static register<T extends WorkspaceAppMapCommand>(
    context: vscode.ExtensionContext,
    commandClass: new (
      context: vscode.ExtensionContext,
      workspaceFolder: vscode.WorkspaceFolder
    ) => T,
    commandId: string
  ) {
    const command = vscode.commands.registerCommand(
      commandId,
      async (workspaceFolder?: vscode.WorkspaceFolder) => {
        if (!workspaceFolder) workspaceFolder = await chooseWorkspace();
        if (!workspaceFolder) return;

        // Construct an instance of dynamically provided class commandClass
        const compare = new commandClass(context, workspaceFolder);
        await compare.run();
      }
    );
    context.subscriptions.push(command);
  }

  protected abstract performRequest(project: ProjectStructure): Promise<void>;
}
