import * as vscode from 'vscode';
import { existsSync, mkdirSync, readFile, writeFileSync } from 'fs';
import { resolve } from 'path';
import { promisify } from 'util';
import ExtensionState, { Keys } from '../configuration/extensionState';
import { WorkspaceService, WorkspaceServiceInstance } from './workspaceService';
import { ADD_RECOMMENDATION, Telemetry } from '../telemetry';

type ExtensionsJson = {
  recommendations?: Array<string>;
  unwantedRecommendations?: Array<string>;
};

export class AppMapRecommenderServiceInstance implements WorkspaceServiceInstance {
  constructor(
    public readonly folder: vscode.WorkspaceFolder,
    protected readonly extensionState: ExtensionState
  ) {
    extensionState.onWorkspaceFlag(async (event) => {
      if (event.workspaceFolder === folder && event.key === Keys.Workspace.CLOSED_APPMAP) {
        const response = await this.askUser();
        Telemetry.sendEvent(ADD_RECOMMENDATION, { result: response === 'Yes' ? 'true' : 'false' });
        if (response === 'Yes') await this.recommendAppMap();
      }
    });
  }

  async askUser(): Promise<string | undefined> {
    return await vscode.window.showInformationMessage(
      'Add AppMap as a recommended extension for this project?',
      'Yes',
      'No'
    );
  }

  async recommendAppMap(): Promise<void> {
    const workspacePath = this.folder.uri.fsPath;
    const vscodeFolderPath = resolve(workspacePath, '.vscode');

    if (!existsSync(vscodeFolderPath)) {
      mkdirSync(resolve(workspacePath, '.vscode'));
    }

    const vscodeExtensionsPath = resolve(this.folder.uri.fsPath, '.vscode', 'extensions.json');
    let content = {} as ExtensionsJson;

    if (existsSync(vscodeExtensionsPath)) {
      const rawContent = await promisify(readFile)(vscodeExtensionsPath, 'utf8');
      try {
        content = JSON.parse(rawContent);
      } catch (e) {
        // don't do anything if an error is raised when parsing extensions.json
        vscode.window.showInformationMessage('ERROR: The extensions.json file could not be read.');
        return;
      }
    }

    if (content.recommendations && Array.isArray(content.recommendations)) {
      if (!content.recommendations.includes('appland.appmap'))
        content.recommendations.push('appland.appmap');
    } else if (!content.recommendations) {
      content.recommendations = ['appland.appmap'];
    }

    writeFileSync(vscodeExtensionsPath, JSON.stringify(content, null, 2));
    const extensionsJson = await vscode.workspace.openTextDocument(vscodeExtensionsPath);
    await vscode.window.showTextDocument(extensionsJson);
  }

  dispose(): void {
    return;
  }
}

export class AppMapRecommenderService
  implements WorkspaceService<AppMapRecommenderServiceInstance>
{
  public static readonly serviceId = 'AppMapRecommenderService';
  constructor(protected extensionState: ExtensionState) {}

  async create(folder: vscode.WorkspaceFolder): Promise<AppMapRecommenderServiceInstance> {
    return new AppMapRecommenderServiceInstance(folder, this.extensionState);
  }
}
