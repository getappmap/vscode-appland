import { ChildProcess, spawn } from 'child_process';
import { assert } from 'console';
import EventEmitter from 'events';
import { readFile } from 'fs';
import { resolve } from 'path';
import { promisify } from 'util';
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
  outofDateAppMapFiles: Set<string> = new Set();

  constructor(public folder: vscode.WorkspaceFolder) {
    super();

    this.commandArgs = ['appmap', 'depends'];
  }

  async initialize(): Promise<void> {
    this.command = await Command.commandArgs(this.folder, this.commandArgs, {});

    this.interval = setInterval(this.update.bind(this), UPDATE_INTERVAL);
  }

  async outOfDateTestFiles(): Promise<Set<string>> {
    const result = new Set<string>();
    await Promise.all(
      [...this.outofDateAppMapFiles].map(async (file) => {
        let metadataData: string;
        try {
          metadataData = await promisify(readFile)(
            resolve(this.folder.uri.fsPath, file, 'metadata.json'),
            'utf8'
          );
        } catch (err) {
          console.log(`[appmap-uptodate-service] ${file} has no indexed metadata (${err})`);
          return;
        }
        const metadata = JSON.parse(metadataData);
        if (metadata.source_location) {
          const [path] = metadata.source_location.split(':');
          result.add(path);
        }
      })
    );
    return result;
  }

  isOutOfDate(appmapFile: string): boolean {
    return this.outofDateAppMapFiles.has(appmapFile);
  }

  dispose(): void {
    if (this.interval) clearTimeout(this.interval);

    this.outofDateAppMapFiles = new Set();
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
    this.outofDateAppMapFiles = new Set(responseData.split('\n'));
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

  async outOfDateTestFileUris(): Promise<vscode.Uri[]> {
    const result = new Set<string>();
    await Promise.all(
      Object.values(this.serviceInstances).map(async (service) =>
        (await service.outOfDateTestFiles()).forEach((filePath) => result.add(filePath))
      )
    );
    return [...result].sort().map(vscode.Uri.file);
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
