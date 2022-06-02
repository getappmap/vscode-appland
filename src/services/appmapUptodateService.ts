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
// TODO: Back off the interval if the depends process is taking too long.
const UPDATE_INTERVAL = 5 * 1000;

export default class AppmapUptodateServiceInstance extends EventEmitter
  implements WorkspaceServiceInstance {
  command?: Command;
  commandArgs: string[];
  interval?: NodeJS.Timeout;
  process?: ChildProcess;
  outofDateAppMapLocations: Set<string> = new Set();
  outofDateAppMapFiles: Set<string> = new Set();

  constructor(public folder: vscode.WorkspaceFolder) {
    super();

    this.commandArgs = ['appmap', 'depends'];
  }

  async initialize(): Promise<void> {
    this.command = await Command.commandArgs(this.folder, this.commandArgs, {});

    this.interval = setInterval(this.update.bind(this), UPDATE_INTERVAL);
  }

  async outOfDateTestLocations(): Promise<Set<string>> {
    return this.outofDateAppMapLocations;
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
        this.handleResponse(buffer.trim());
      }
    });
  }

  protected async handleResponse(responseData: string): Promise<void> {
    const outofDateAppMapFiles = new Set(responseData.split('\n'));
    const outofDateAppMapLocations = await this.collectOutOfDateTestLocations(outofDateAppMapFiles);
    this.outofDateAppMapFiles = outofDateAppMapFiles;
    this.outofDateAppMapLocations = outofDateAppMapLocations;
    this.emit('updated');
  }

  private async collectOutOfDateTestLocations(
    outofDateAppMapFiles: Set<string>
  ): Promise<Set<string>> {
    const result = new Set<string>();
    await Promise.all(
      [...outofDateAppMapFiles].map(async (file) => {
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
          const location = metadata.source_location.startsWith(this.folder.uri.fsPath)
            ? metadata.source_location.slice(this.folder.uri.fsPath.length + 1)
            : metadata.source_location;
          result.add(location);
        }
      })
    );
    return result;
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

  /**
   * Gets the list of test files, with line numbers if available, that are out of date.
   *
   * @param workspaceFolder optional folder to filter by
   * @returns array of file paths with line numbers, delimited by `:`.
   * Example: app/models/document.rb, app/models/user.ts:10
   */
  async outOfDateTestLocations(workspaceFolder?: vscode.Uri): Promise<string[]> {
    const result = new Set<string>();

    const serviceInstances = workspaceFolder
      ? [this.serviceInstances[workspaceFolder.toString()]].filter(Boolean)
      : Object.values(this.serviceInstances);
    if (serviceInstances.length === 0) return [];

    await Promise.all(
      Object.values(serviceInstances).map(async (service) =>
        (await service.outOfDateTestLocations()).forEach((filePath) => result.add(filePath))
      )
    );
    return [...result].sort();
  }

  /**
   * Determines whether an AppMap is up-to-date with regard to known dependency files.
   *
   * @param appmapUri Full path to an AppMap.
   */
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

/**
 * Strip line numbers from an array of `filePath<:location?>.
 *
 * @returns sorted, unique file paths.
 */
export function fileLocationsToFilePaths(fileLocations: string[]): string[] {
  return [...new Set(fileLocations.map((fileLocation) => fileLocation.split(':')[0]))].sort();
}
