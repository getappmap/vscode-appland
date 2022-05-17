import * as vscode from 'vscode';
import extensionSettings from '../configuration/extensionSettings';
import ProcessService from './processService';
import { WorkspaceService, WorkspaceServiceInstance } from './workspaceService';

class AutoIndexer extends ProcessService implements WorkspaceServiceInstance {
  async start(): Promise<void> {
    const command = extensionSettings.indexCommand();
    let commandArgs: string[];
    if (typeof command === 'string') {
      commandArgs = command.split(' ');
    } else {
      commandArgs = command;
    }

    return this.runProcess(commandArgs, {});
  }
}

export default class AutoIndexerService implements WorkspaceService {
  async create(folder: vscode.WorkspaceFolder): Promise<AutoIndexer> {
    const indexer = new AutoIndexer(folder);
    await indexer.start();
    return indexer;
  }
}
