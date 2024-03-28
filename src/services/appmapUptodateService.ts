import assert from 'assert';
import {
  ChildProcess,
  ProgramName,
  OutputStream,
  ProcessLogItem,
  spawn,
  getModulePath,
} from './nodeDependencyProcess';
import EventEmitter from 'events';
import { readFile } from 'fs';
import { resolve } from 'path';
import { promisify } from 'util';
import * as vscode from 'vscode';
import ChangeEventDebouncer from './changeEventDebouncer';
import { WorkspaceService, WorkspaceServiceInstance } from './workspaceService';
import { workspaceServices } from './workspaceServices';
import AssetService, { AssetIdentifier } from '../assets/assetService';

export default class AppmapUptodateServiceInstance
  extends EventEmitter
  implements WorkspaceServiceInstance
{
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
    // Run only one uptodate job at a time.
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

    // Do not await between here and where this.process is set to a concrete value.
    // Otherwise the guard that this variable is designed to provide will not work.
    while (this.process) await processCompletion();

    // We are queued up to wait, but another job is already running that started after the time that
    // we began our update request.
    if (this.updatedAt && this.updatedAt > updateRequestedAt) return;

    const modulePath = getModulePath(ProgramName.Appmap);
    this.process = spawn({
      modulePath,
      binPath: AssetService.getAssetPath(AssetIdentifier.AppMapCli),
      args: this.commandArgs,
      cwd: this.folder.uri.fsPath,
      saveOutput: true,
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
        .filter((line) => line.stream === OutputStream.Stdout)
        .map((line) => line.data)
        .join('')
        .split('\n')
        .map((line) => line.trim())
        .filter((line) => line.length > 0)
        // Begin: Handle some anomalous behavior where the file path contains logging output:
        .filter((line) => !line.startsWith('yarn run v'))
        .filter((line) => !line.startsWith('Done in '))
        .filter((line) => !line.includes('appmap depends'))
        // End: anomalous output filters
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
  public static readonly serviceId = 'AppmapUptodateService';
  private _onUpdated: vscode.EventEmitter<AppmapUptodateService> =
    new ChangeEventDebouncer<AppmapUptodateService>();
  public readonly onUpdated: vscode.Event<AppmapUptodateService> = this._onUpdated.event;
  protected readonly globalStoragePath: string;

  constructor(context: vscode.ExtensionContext) {
    this.globalStoragePath = context.globalStorageUri.fsPath;
  }

  async create(folder: vscode.WorkspaceFolder): Promise<AppmapUptodateServiceInstance> {
    const uptodate = new AppmapUptodateServiceInstance(folder, this.globalStoragePath);
    await uptodate.update();
    uptodate.on('updated', () => this._onUpdated.fire(this));
    return uptodate;
  }

  dispose(): void {
    this._onUpdated.dispose();
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

    const serviceInstances = workspaceServices().getServiceInstances<AppmapUptodateService>(
      this,
      workspaceFolder
    );

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
      .getServiceInstances<AppmapUptodateService>(this)
      .find((service) => appmapUri.fsPath.startsWith(service.folder.uri.fsPath));
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
