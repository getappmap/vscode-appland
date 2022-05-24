import { EventEmitter } from 'stream';
import * as vscode from 'vscode';
import extensionSettings from '../configuration/extensionSettings';
import ProcessService from './processService';
import { WorkspaceService, WorkspaceServiceInstance } from './workspaceService';

class AutoScanner extends ProcessService implements WorkspaceServiceInstance {
  constructor(public folder: vscode.WorkspaceFolder) {
    super(folder, extensionSettings.scanCommand);
  }
}

export default class AutoScannerService extends EventEmitter implements WorkspaceService {
  async create(folder: vscode.WorkspaceFolder): Promise<AutoScanner> {
    const scanner = new AutoScanner(folder);
    ['invoke', 'message', 'exit'].forEach((event) =>
      scanner.on(event, (...args) => this.emit(event, ...args))
    );
    await scanner.start();
    return scanner;
  }
}
