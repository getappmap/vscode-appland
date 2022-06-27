import assert from 'assert';
import {
  ChildProcess,
  Dependency,
  OutputStream,
  ProcessLogItem,
  spawn,
} from './nodeDependencyProcess';
import EventEmitter from 'events';
import { readFile } from 'fs';
import { resolve } from 'path';
import { promisify } from 'util';
import * as vscode from 'vscode';
import ChangeEventDebouncer from './changeEventDebouncer';
import { WorkspaceService, WorkspaceServiceInstance } from './workspaceService';
import { workspaceServices } from './workspaceServices';

export default class AppmapUptodateServiceInstance extends EventEmitter
  implements WorkspaceServiceInstance {
  interval?: NodeJS.Timeout;
  process?: ChildProcess;
  updatedAt?: number;
  outofDateAppMapLocations: Set<string> = new Set();
  outofDateAppMapFiles: Set<string> = new Set();

  constructor(public folder: vscode.WorkspaceFolder, protected readonly globalStoragePath: string) {
    super();
  }

  protected get commandArgs(): string[] {
    const { fsPath: workspaceFolder } = this.folder.uri;
    return ['depends', '--base-dir', workspaceFolder, '--appmap-dir', workspaceFolder];
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

    this.process = await spawn({
      bin: { dependency: Dependency.Appmap, globalStoragePath: this.globalStoragePath },
      args: this.commandArgs,
      cwd: this.folder.uri.fsPath,
      cacheLog: true,
    });
    this.updatedAt = Date.now();
    this.process.once('exit', (code) => {
      const processLog = this.process?.log || [];
      this.process = undefined;
      if (code === 0) {
        this.handleResponse(processLog);
      }
    });
  }

  protected async handleResponse(processLog: Readonly<ProcessLogItem[]>): Promise<void> {
    const outofDateAppMapFiles = new Set(
      processLog
        .filter((line) => line.stream === OutputStream.Stdout && line.data.length > 0)
        .map((line) => resolve(this.folder.uri.fsPath, line.data))
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
  protected readonly globalStoragePath: string;

  constructor(context: vscode.ExtensionContext) {
    this.globalStoragePath = context.globalStorageUri.fsPath;
  }

  async create(folder: vscode.WorkspaceFolder): Promise<AppmapUptodateServiceInstance> {
    const uptodate = new AppmapUptodateServiceInstance(folder, this.globalStoragePath);
    uptodate.on('updated', () => this._onUpdated.fire(this));
    await uptodate.update();
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
