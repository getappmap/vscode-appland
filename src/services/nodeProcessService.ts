import * as vscode from 'vscode';
import * as path from 'path';
import os from 'os';
import { DEBUG_EXCEPTION, Telemetry } from '../telemetry';
import { createWriteStream, promises as fs } from 'fs';
import { WorkspaceService } from './workspaceService';
import NodeProcessServiceInstance from './nodeProcessServiceInstance';
import { ProcessWatcher } from './processWatcher';
import ErrorCode from '../telemetry/definitions/errorCodes';
import { getBinPath, ProgramName, spawn } from './nodeDependencyProcess';
import { ProjectStateServiceInstance } from './projectStateService';
import { downloadFile, getLatestVersionInfo } from '../util';
import AnalysisManager from './analysisManager';
import { lookupAppMapDir } from '../lib/appmapDir';

const YARN_JS = 'yarn.js';

export class NodeProcessService implements WorkspaceService<NodeProcessServiceInstance> {
  protected externDir: string;
  protected globalStorageDir: string;
  protected COPY_FILES: string[] = ['package.json', 'yarn.lock', YARN_JS];
  protected static outputChannel = vscode.window.createOutputChannel('AppMap: Services');
  protected static readonly DEFAULT_APPMAP_DIR = '.';

  protected _hasCLIBin = false;
  get hasCLIBin(): boolean {
    return this._hasCLIBin;
  }

  protected _ready = false;
  get ready(): boolean {
    return this._ready;
  }

  protected _onReady = new vscode.EventEmitter<void>();
  get onReady(): vscode.Event<void> {
    return this._onReady.event;
  }

  constructor(
    context: vscode.ExtensionContext,
    protected projectStates: Readonly<Array<ProjectStateServiceInstance>>
  ) {
    this.globalStorageDir = context.globalStorageUri.fsPath;
    this.externDir = path.join(context.extensionPath, 'extern');
  }

  async create(folder: vscode.WorkspaceFolder): Promise<NodeProcessServiceInstance> {
    const services: ProcessWatcher[] = [];
    const projectState = this.projectStates.find((projectState) => projectState.folder === folder);
    if (!projectState) {
      throw new Error(`failed to resolve a project state for ${folder.name}`);
    }

    let appMapDir = await lookupAppMapDir(folder.uri.fsPath);
    if (appMapDir) {
      try {
        await fs.mkdir(path.join(folder.uri.fsPath, appMapDir), { recursive: true });
      } catch (e) {
        appMapDir = NodeProcessService.DEFAULT_APPMAP_DIR;
        Telemetry.sendEvent(DEBUG_EXCEPTION, {
          exception: new Error('Failed to create appmap_dir: ' + String(e)),
        });
      }
    } else {
      appMapDir = NodeProcessService.DEFAULT_APPMAP_DIR;
    }

    try {
      const env = process.env.APPMAP_TEST
        ? { ...process.env, APPMAP_WRITE_PIDFILE: 'true' }
        : undefined;
      services.push(
        new ProcessWatcher({
          id: 'index',
          binPath: await getBinPath({
            dependency: ProgramName.Appmap,
            globalStoragePath: this.globalStorageDir,
          }),
          log: NodeProcessService.outputChannel,
          args: ['index', '--watch', '--appmap-dir', appMapDir],
          cwd: folder.uri.fsPath,
          env,
        }),
        new ProcessWatcher({
          id: 'analysis',
          startCondition: () => AnalysisManager.isAnalysisEnabled,
          binPath: await getBinPath({
            dependency: ProgramName.Scanner,
            globalStoragePath: this.globalStorageDir,
          }),
          log: NodeProcessService.outputChannel,
          args: ['scan', '--watch', '--appmap-dir', appMapDir],
          cwd: folder.uri.fsPath,
        })
      );
    } catch (e) {
      Telemetry.sendEvent(DEBUG_EXCEPTION, {
        exception: e as Error,
        errorCode: ErrorCode.DependencyPathNotResolved,
      });
    }

    const instance = new NodeProcessServiceInstance(folder, services, projectState);
    await instance.initialize();

    return instance;
  }

  protected get yarnPath(): string {
    return path.join(this.globalStorageDir, YARN_JS);
  }

  protected async installCLIBin(): Promise<boolean> {
    const cliBinPath = path.join(this.globalStorageDir, 'appmap-win-x64.exe');
    const cliBin = createWriteStream(cliBinPath, { autoClose: true });
    const latestVersion = (await getLatestVersionInfo('appmap'))?.version;
    const url = `https://github.com/getappmap/appmap-js/releases/download/%40appland%2Fappmap-v${latestVersion}/appmap-win-x64.exe`;
    return await downloadFile(url, cliBin);
  }

  async install(): Promise<void> {
    try {
      await fs.mkdir(this.globalStorageDir, { recursive: true });

      await Promise.all(
        this.COPY_FILES.map((fileName) =>
          fs.copyFile(
            path.join(this.externDir, fileName),
            path.join(this.globalStorageDir, fileName)
          )
        )
      );

      await fs.writeFile(
        path.join(this.globalStorageDir, '.yarnrc.yml'),
        ['nodeLinker: node-modules', 'npmRegistryServer: "https://registry.npmjs.org"'].join('\n')
      );

      const installProcess = await spawn({
        args: [this.yarnPath, 'install'],
        cwd: this.globalStorageDir,
        log: NodeProcessService.outputChannel,
      });

      installProcess.log.append('Installing dependencies...');

      return new Promise((resolve, reject) => {
        installProcess.once('error', (err) => reject(err));
        installProcess.once('exit', async (code, signal) => {
          if (code && code !== 0) {
            const message = [
              'Failed to install dependencies',
              `Exit code: ${code}`,
              `Signal: ${signal}`,
              installProcess.log.toString(),
            ].join('\n');
            reject(new Error(message));
          }

          if (os.platform() === 'win32') {
            this._hasCLIBin = await this.installCLIBin();
          }

          installProcess.log.append('Installation of AppMap services is complete.');

          this._ready = true;
          this._onReady.fire();
          resolve();
        });
      });
    } catch (e) {
      const err =
        e instanceof Error ? e : new Error(`failed to install node dependencies: ${String(e)}`);
      Telemetry.sendEvent(DEBUG_EXCEPTION, {
        exception: err,
        errorCode: ErrorCode.DependencyInstallFailure,
      });
    }
  }
}
