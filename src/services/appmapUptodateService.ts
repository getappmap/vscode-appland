import { ChildProcess, spawn } from 'child_process';
import { assert } from 'console';
import EventEmitter from 'events';
import * as vscode from 'vscode';
import ChangeEventDebouncer from './changeEventDebouncer';
import Command from './command';
import { WorkspaceService, WorkspaceServiceInstance } from './workspaceService';

// Update as often as every five seconds.
const UPDATE_INTERVAL = 5 * 1000;

export default class AppmapUptodateServiceInstance extends EventEmitter
  implements WorkspaceServiceInstance {
  command?: Command;
  commandArgs: string[];
  interval?: NodeJS.Timeout;
  process?: ChildProcess;
  outofDateAppMapNames: Set<string> = new Set();

  constructor(public folder: vscode.WorkspaceFolder) {
    super();

    this.commandArgs = ['appmap', 'depends'];
  }

  async initialize(): Promise<void> {
    this.command = await Command.commandArgs(this.folder, this.commandArgs, {});

    this.interval = setInterval(this.update.bind(this), UPDATE_INTERVAL);
  }

  isOutOfDate(appmapFile: string): boolean {
    return this.outofDateAppMapNames.has(appmapFile);
  }

  dispose(): void {
    if (this.interval) clearTimeout(this.interval);

    this.outofDateAppMapNames = new Set();
    this.interval = undefined;
  }

  protected async update(): Promise<void> {
    if (this.process) return;
    if (!this.command) return assert(this.command);

    const process = spawn(this.command.mainCommand, this.command.args, this.command.options);
    if (!process.stdout) return assert(process.stdout);
    if (!process.stderr) return assert(process.stderr);
    this.process = process;
    let buffer = '';
    process.stdout.setEncoding('utf8');
    process.stdout.on('data', (data) => {
      buffer += data;
    });
    process.stderr.setEncoding('utf8');
    process.stderr.on('data', (data) => {
      console.warn(`[appmap-uptodate-service] ${data}`);
    });
    this.process.once('exit', (code) => {
      this.process = undefined;
      if (code === 0) {
        this.handleResponse(buffer);
      }
    });
  }

  protected async handleResponse(responseData: string): Promise<void> {
    this.outofDateAppMapNames = new Set(responseData.split('\n'));
    this.emit('updated');
  }
}

export class AppmapUptodateService implements WorkspaceService {
  private _onUpdated: vscode.EventEmitter<AppmapUptodateService> = new ChangeEventDebouncer<
    AppmapUptodateService
  >();
  public readonly onUpdated: vscode.Event<AppmapUptodateService> = this._onUpdated.event;

  serviceInstances: Record<string, AppmapUptodateServiceInstance> = {};

  async create(folder: vscode.WorkspaceFolder): Promise<AppmapUptodateServiceInstance> {
    const uptodate = new AppmapUptodateServiceInstance(folder);
    uptodate.on('updated', () => this._onUpdated.fire(this));
    await uptodate.initialize();
    this.serviceInstances[folder.uri.toString()] = uptodate;
    return uptodate;
  }

  isUpToDate(appmapUri: vscode.Uri): boolean {
    const serviceInstance = Object.values(this.serviceInstances).find((service) =>
      appmapUri.fsPath.startsWith(service.folder.uri.fsPath)
    );
    if (!serviceInstance) return true;

    return !serviceInstance.isOutOfDate(
      appmapUri.fsPath.slice(
        serviceInstance.folder.uri.fsPath.length + 1,
        appmapUri.fsPath.length - '.appmap.json'.length
      )
    );
  }
}
