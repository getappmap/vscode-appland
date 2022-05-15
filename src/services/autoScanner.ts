import * as vscode from 'vscode';
import extensionSettings from '../extensionSettings';
import ProcessService from '../util/processService';
import { WorkspaceService, WorkspaceServiceInstance } from './workspaceService';

class AutoScanner extends ProcessService implements WorkspaceServiceInstance {
  async start(): Promise<void> {
    const command = extensionSettings.scanCommand();
    let commandArgs: [string, string[]];
    if (typeof command === 'string') {
      const tokens = command.split(' ');
      commandArgs = [tokens[0], tokens.slice(1)];
    } else {
      commandArgs = command;
    }

    return this.runProcess(commandArgs[0], commandArgs[1], {});
  }
}

export default class AutoScannerService implements WorkspaceService {
  async create(folder: vscode.WorkspaceFolder): Promise<AutoScanner> {
    const scanner = new AutoScanner(folder);
    await scanner.start();
    return scanner;
  }
}
