import { EventEmitter } from 'stream';
import * as vscode from 'vscode';
import extensionSettings from '../configuration/extensionSettings';
import ProcessService from './processService';
import { WorkspaceService, WorkspaceServiceInstance } from './workspaceService';

class AutoIndexer extends ProcessService implements WorkspaceServiceInstance {
  constructor(public folder: vscode.WorkspaceFolder) {
    super(folder, extensionSettings.indexCommand);
  }
}

export default class AutoIndexerService extends EventEmitter implements WorkspaceService {
  async create(folder: vscode.WorkspaceFolder): Promise<AutoIndexer> {
    const indexer = new AutoIndexer(folder);
    ['invoke', 'message', 'exit'].forEach((event) =>
      indexer.on(event, (...args) => this.emit(event, ...args))
    );
    await indexer.start();
    return indexer;
  }
}
