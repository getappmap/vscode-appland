import * as vscode from 'vscode';
import extensionSettings from '../configuration/extensionSettings';
import ProcessService from './processService';
import { WorkspaceService, WorkspaceServiceInstance } from './workspaceService';

class AutoScanner extends ProcessService implements WorkspaceServiceInstance {
  async start(): Promise<void> {
    const command = extensionSettings.scanCommand();
    let commandArgs: string[];
    if (typeof command === 'string') {
      commandArgs = command.split(' ');
    } else {
      commandArgs = command;
    }

    this.runProcess(commandArgs, {});
  }
}

export default class AutoScannerService implements WorkspaceService {
  async create(folder: vscode.WorkspaceFolder): Promise<AutoScanner> {
    const scanner = new AutoScanner(folder);
    await scanner.start();
    return scanner;
  }
}
