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
import lockfile from 'proper-lockfile';

const YARN_JS = 'yarn.js';
const PACKAGE_JSON = 'package.json';
const INSTALL_SUCCESS_MESSAGE = 'Installation of AppMap services is complete.';

export class NodeProcessService implements WorkspaceService<NodeProcessServiceInstance> {
  protected externDir: string;
  protected globalStorageDir: string;
  protected COPY_FILES: string[] = [PACKAGE_JSON, YARN_JS];
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

  protected get packageJsonPath(): string {
    return path.join(this.globalStorageDir, PACKAGE_JSON);
  }

  protected async installCLIBin(): Promise<boolean> {
    const cliBinPath = path.join(this.globalStorageDir, 'appmap-win-x64.exe');
    const cliBin = createWriteStream(cliBinPath, { autoClose: true });
    const latestVersion = (await getLatestVersionInfo('appmap'))?.version;
    const url = `https://github.com/getappmap/appmap-js/releases/download/%40appland%2Fappmap-v${latestVersion}/appmap-win-x64.exe`;
    return await downloadFile(url, cliBin);
  }

  async install(): Promise<void> {
    const { outputChannel: log } = NodeProcessService;

    try {
      await fs.mkdir(this.globalStorageDir, { recursive: true });
    } catch (e) {
      // Ignore this error, it's probably because the directory already exists.
      log.appendLine('Failed to create the global storage directory.');
      log.appendLine(String(e));
    }

    let lockfileRelease: () => Promise<void> | undefined;
    try {
      // If multiple VS Code windows are open, we may have multiple processes racing to install.
      // Only let one process continue.
      lockfileRelease = await lockfile.lock(this.globalStorageDir);
    } catch (e) {
      // We didn't aquire the lock, so we'll assume that another process is already installing.
      // We'll just wait for it to finish.
      log.appendLine('Another process is currently installing dependencies. Waiting...');

      let installSuccess = true;
      for (;;) {
        // Add a little randomness to avoid multiple processes checking all at once.
        const nextCheckMs = 500 + Math.random() * 500;
        await new Promise((resolve) => setTimeout(resolve, nextCheckMs));

        try {
          const isLocked = await lockfile.check(this.globalStorageDir);
          if (!isLocked) break;
        } catch (e) {
          // This is likely not resolvable as ENOENT is gracefully handled by the library.
          // The best we can do is log the error and continue on as best we can. It's possible there's
          // a viable installation already installed.
          Telemetry.sendEvent(DEBUG_EXCEPTION, {
            exception: e as Error,
            errorCode: ErrorCode.DependencyLockFailure,
          });

          log.appendLine('An error occurred while checking the installation status:');
          log.appendLine(String(e));

          // Note that we're not returning here. We'll still be reporting a ready state, whether or not it's true.
          // If no viable installation is present we can expect another error down the line.
          installSuccess = false;
        }
      }

      // By this point, the other process should have finished installing.
      // TODO: we have no way of telling if the installation was actually successful, we're just
      //       assuming that it was.
      this._ready = true;
      this._onReady.fire();

      if (installSuccess) log.appendLine(INSTALL_SUCCESS_MESSAGE);

      return;
    }

    // We have the lock, so we'll install.
    try {
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

      // Write an empty yarn.lock if it doesn't already exist. This allows us to avoid needing
      // to run `yarn install` to create it. `yarn up` will happilly update an empty lock file.
      await fs.appendFile(path.join(this.globalStorageDir, 'yarn.lock'), '');

      const installProcess = await spawn({
        binPath: this.yarnPath,
        args: ['up'],
        cwd: this.globalStorageDir,
        log: NodeProcessService.outputChannel,
      });

      installProcess.log.append('Installing dependencies...');

      await new Promise<void>((resolve, reject) => {
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

          installProcess.log.append(INSTALL_SUCCESS_MESSAGE);

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
    } finally {
      try {
        if (lockfileRelease) await lockfileRelease();
      } catch (e) {
        Telemetry.sendEvent(DEBUG_EXCEPTION, {
          exception: e as Error,
          errorCode: ErrorCode.DependencyLockFailure,
        });
      }
    }
  }
}
