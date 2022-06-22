import assert from 'assert';
import { ChildProcess, spawn } from 'child_process';
import EventEmitter from 'events';
import { readFile } from 'fs';
import { resolve } from 'path';
import { promisify } from 'util';
import * as vscode from 'vscode';
import extensionSettings from '../configuration/extensionSettings';
import ChangeEventDebouncer from './changeEventDebouncer';
import Command from './command';
import { WorkspaceService, WorkspaceServiceInstance } from './workspaceService';
import { workspaceServices } from './workspaceServices';

export default class AppmapUptodateServiceInstance extends EventEmitter
  implements WorkspaceServiceInstance {
  command?: Command;
  interval?: NodeJS.Timeout;
  process?: ChildProcess;
  updatedAt?: number;
  outofDateAppMapLocations: Set<string> = new Set();
  outofDateAppMapFiles: Set<string> = new Set();

  constructor(public folder: vscode.WorkspaceFolder) {
    super();
  }

  async initialize(): Promise<void> {
    const commandSetting = extensionSettings.dependsCommand();
    let command: Command;
    if (typeof commandSetting === 'string') {
      const commandArgs = commandSetting
        .replaceAll('${workspaceFolder}', this.folder.uri.fsPath)
        .split(' ');
      const mainCommand = commandArgs.shift();
      assert(mainCommand);
      command = new Command(mainCommand as string, commandArgs, {});
    } else {
      command = await Command.commandArgs(this.folder, commandSetting, {});
    }
    this.command = command;
    this.update();
  }

  outOfDateTestLocations(): Set<string> {
    return this.outofDateAppMapLocations;
  }

  isOutOfDate(appmapFile: string): boolean {
    const resolvedFile = resolve(this.folder.uri.fsPath, appmapFile);
    const isOutOfDate = this.outofDateAppMapFiles.has(resolvedFile);
    return isOutOfDate;
  }

  dispose(): void {
    if (this.interval) clearTimeout(this.interval);

    this.outofDateAppMapFiles = new Set();
    this.interval = undefined;
  }

  async update(): Promise<void> {
    const updateRequestedAt = Date.now();

    const processCompletion = async (): Promise<void> => {
      return new Promise<void>((resolve) => {
        // eslint-disable-next-line prefer-const
        let interval: NodeJS.Timeout | undefined;
        const waitForProcessCompletion = () => {
          if (this.process === undefined) {
            assert(interval);
            clearTimeout(interval);
            resolve();
          }
        };
        interval = setInterval(waitForProcessCompletion, 100);
      });
    };

    while (this.process) await processCompletion();

    // We are queued up to wait, but another job is already running that started after the time that
    // we began our update request.
    if (this.updatedAt && this.updatedAt > updateRequestedAt) return;

    assert(this.command);

    const process = spawn(this.command.mainCommand, this.command.args, this.command.options);
    this.updatedAt = Date.now();
    assert(process.stdout);
    assert(process.stderr);
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
    const outofDateAppMapFiles = new Set(
      responseData
        .split('\n')
        .map((line) => line.trim())
        .filter((line) => line.length > 0)
        .map((line) => resolve(this.folder.uri.fsPath, line))
    );
    const outofDateAppMapLocations = await this.collectOutOfDateTestLocations(outofDateAppMapFiles);
    console.log(
      `[uptodate] ${outofDateAppMapLocations.size} test cases are not up-to-date in ${this.folder.name}`
    );
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
        // Handle some anomalous behavior where the file path contains logging output:
        if (file.startsWith('yarn run v')) return;
        if (file.startsWith('Done in ')) return;
        if (file.includes('appmap depends')) return;

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

export class AppmapUptodateService implements WorkspaceService<AppmapUptodateServiceInstance> {
  private _onUpdated: vscode.EventEmitter<AppmapUptodateService> = new ChangeEventDebouncer<
    AppmapUptodateService
  >();
  public readonly onUpdated: vscode.Event<AppmapUptodateService> = this._onUpdated.event;

  async create(folder: vscode.WorkspaceFolder): Promise<AppmapUptodateServiceInstance> {
    const uptodate = new AppmapUptodateServiceInstance(folder);
    uptodate.on('updated', () => this._onUpdated.fire(this));
    await uptodate.initialize();
    return uptodate;
  }

  /**
   * Gets the list of test files, with line numbers if available, that are out of date.
   *
   * @param workspaceFolder optional folder to filter by
   * @returns array of file paths with line numbers, delimited by `:`.
   * Example: app/models/document.rb, app/models/user.ts:10
   */
  async outOfDateTestLocations(workspaceFolder?: vscode.WorkspaceFolder): Promise<string[]> {
    const result = new Set<string>();

    const serviceInstances = workspaceServices().getServiceInstances(
      this,
      workspaceFolder
    ) as AppmapUptodateServiceInstance[];

    await Promise.all(
      serviceInstances.map((service) =>
        service.outOfDateTestLocations().forEach((filePath) => result.add(filePath))
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
    const serviceInstance = workspaceServices()
      .getServiceInstances(this)
      .find((service) =>
        appmapUri.fsPath.startsWith(service.folder.uri.fsPath)
      ) as AppmapUptodateServiceInstance;
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
