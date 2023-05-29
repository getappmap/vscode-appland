import { createWriteStream, promises as fs } from 'fs';
import os from 'os';
import * as path from 'path';
import lockfile from 'proper-lockfile';
import * as vscode from 'vscode';

import Environment from '../configuration/environment';
import { DEBUG_EXCEPTION, Telemetry } from '../telemetry';
import ErrorCode from '../telemetry/definitions/errorCodes';
import { downloadFile, getLatestVersionInfo } from '../util';
import IndexProcessWatcher from './indexProcessWatcher';
import { getModulePath, ProgramName, spawn } from './nodeDependencyProcess';
import NodeProcessServiceInstance from './nodeProcessServiceInstance';
import { ProcessWatcher } from './processWatcher';
import ScanProcessWatcher from './scanProcessWatcher';
import { WorkspaceService } from './workspaceService';
import { AppmapConfigManager, AppmapConfigManagerInstance } from './appmapConfigManager';
import { workspaceServices } from './workspaceServices';
import assert from 'assert';
import { isNativeError } from 'util/types';

const YARN_JS = 'yarn.js';
const PACKAGE_JSON = 'package.json';
const INSTALL_SUCCESS_MESSAGE = 'Installation of AppMap services is complete.';

export class NodeProcessService implements WorkspaceService<NodeProcessServiceInstance> {
  public static outputChannel = vscode.window.createOutputChannel('AppMap: Services');

  protected externDir: string;
  protected globalStorageDir: string;
  protected static COPY_FILES: string[] = [PACKAGE_JSON, YARN_JS];
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

  constructor(protected context: vscode.ExtensionContext) {
    this.globalStorageDir = context.globalStorageUri.fsPath;
    this.externDir = path.join(context.extensionPath, 'extern');
  }

  async create(folder: vscode.WorkspaceFolder): Promise<NodeProcessServiceInstance> {
    const services = await this.createServices(folder);
    const instance = new NodeProcessServiceInstance(folder, services);
    instance.initialize();

    const configManagerInstance = workspaceServices().getServiceInstanceFromClass(
      AppmapConfigManager,
      folder
    ) as AppmapConfigManagerInstance | undefined;
    assert(configManagerInstance);

    configManagerInstance.onConfigChanged(async () => this.handleConfigChange(folder));

    return instance;
  }

  private async handleConfigChange(folder: vscode.WorkspaceFolder): Promise<void> {
    const currentInstance = workspaceServices().getServiceInstanceFromClass(
      NodeProcessService,
      folder
    ) as NodeProcessServiceInstance | undefined;
    assert(currentInstance);

    await currentInstance.stop();
    workspaceServices().unenrollServiceInstance(folder, currentInstance);

    const newServices = await this.createServices(folder);
    const newInstance = new NodeProcessServiceInstance(folder, newServices);
    newInstance.initialize();
    workspaceServices().enrollServiceInstance(folder, newInstance, this);
  }

  private async createServices(folder: vscode.WorkspaceFolder): Promise<ProcessWatcher[]> {
    const services: ProcessWatcher[] = [];

    const appmapConfigManagerInstance = workspaceServices().getServiceInstanceFromClass(
      AppmapConfigManager,
      folder
    ) as AppmapConfigManagerInstance | undefined;
    assert(appmapConfigManagerInstance);

    const { configs: appmapConfigs, fileProvider: configFileProvider } =
      appmapConfigManagerInstance.workspaceConfig;

    const env =
      Environment.isSystemTest || Environment.isIntegrationTest
        ? { ...process.env, APPMAP_WRITE_PIDFILE: 'true' }
        : undefined;

    const tryModulePath = async (program: ProgramName): Promise<string | undefined> => {
      try {
        return await getModulePath({
          dependency: program,
          globalStoragePath: this.globalStorageDir,
        });
      } catch (e) {
        Telemetry.sendEvent(DEBUG_EXCEPTION, {
          exception: e as Error,
          errorCode: ErrorCode.DependencyPathNotResolved,
        });
      }
    };

    const appmapModulePath = await tryModulePath(ProgramName.Appmap);
    if (appmapModulePath) {
      appmapConfigs.forEach((appmapConfig) => {
        services.push(
          new IndexProcessWatcher(
            configFileProvider,
            appmapModulePath,
            appmapConfig.appmapDir,
            appmapConfig.configFolder,
            env
          )
        );
      });
    }

    const scannerModulePath = await tryModulePath(ProgramName.Scanner);
    if (scannerModulePath) {
      appmapConfigs.forEach((appmapConfig) => {
        services.push(
          new ScanProcessWatcher(
            configFileProvider,
            scannerModulePath,
            appmapConfig.appmapDir,
            appmapConfig.configFolder,
            env
          )
        );
      });
    }

    return services;
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
    const storagePath = this.globalStorageDir;
    const output = NodeProcessService.outputChannel;

    const logLines: string[] = [];

    function log(line: string) {
      logLines.push(line);
      output.appendLine(line);
    }

    async function createStorageDir(): Promise<void> {
      try {
        log(`Creating storage directory "${storagePath}"`);
        await fs.mkdir(storagePath, { recursive: true });
      } catch (e) {
        // Ignore this error, it's probably because the directory already exists.
        log('Failed to create the global storage directory.');
        log(String(e));
      }
    }

    async function tryLock(): Promise<(() => Promise<void>) | undefined> {
      try {
        log(`Trying to acquire lock on "${storagePath}"`);
        return await lockfile.lock(storagePath);
      } catch (e) {
        assert(isNativeError(e));
        if ('code' in e && e.code === 'ELOCKED') return;
        throw e;
      }
    }

    async function wait(maxMs = 5 * 60 * 1000) {
      // We didn't aquire the lock, so we'll assume that another process is already installing.
      // We'll just wait for it to finish.
      log('Another process is currently installing dependencies. Waiting...');

      let giveUp = false;
      setTimeout(() => {
        giveUp = true;
      }, maxMs).unref();

      let lastException: Error | undefined;
      while (!giveUp) {
        // Add a little randomness to avoid multiple processes checking all at once.
        const nextCheckMs = 5000 + Math.random() * 500;
        await new Promise((resolve) => setTimeout(resolve, nextCheckMs));

        try {
          if (!(await lockfile.check(storagePath))) return;
        } catch (e) {
          assert(isNativeError(e));
          lastException = e;
          // On error, will just try again. After the time limit has elapsed
          // we can report the last error, if any.
        }
      }

      if (lastException) {
        // This is likely not resolvable as ENOENT is gracefully handled by the library.
        // The best we can do is log the error and continue on as best we can. It's possible there's
        // a viable installation already installed.
        log('An error occurred while checking the installation status:');
        log(String(lastException));

        Telemetry.sendEvent(DEBUG_EXCEPTION, {
          exception: lastException,
          errorCode: ErrorCode.DependencyLockFailure,
          log: logLines.join('\n'),
        });
      }

      throw new Error(`Gave up waiting for installation in ${storagePath} to finish`);
    }

    const perform = async () => {
      log(`Performing tools installation in ${storagePath}...`);

      for (const fileName of NodeProcessService.COPY_FILES) {
        await fs.copyFile(
          path.join(this.externDir, fileName),
          path.join(this.globalStorageDir, fileName)
        );
      }

      await fs.writeFile(
        path.join(this.globalStorageDir, '.yarnrc.yml'),
        ['nodeLinker: node-modules', 'npmRegistryServer: "https://registry.npmjs.org"'].join('\n')
      );

      // Write an empty yarn.lock if it doesn't already exist. This allows us to avoid needing
      // to run `yarn install` to create it. `yarn up` will happilly update an empty lock file.
      await fs.appendFile(path.join(this.globalStorageDir, 'yarn.lock'), '');

      const installProcess = spawn({
        modulePath: this.yarnPath,
        args: ['up', '-R', '@appland/appmap', '@appland/scanner'],
        cwd: this.globalStorageDir,
        log: NodeProcessService.outputChannel,
        // Fix "The remote archive doesn't match the expected checksum" issue by
        // forcing yarn to fetch from the remote registry if checksums don't match.
        env: {
          YARN_CHECKSUM_BEHAVIOR: 'update',
          YARN_ENABLE_TELEMETRY: 'false',
          YARN_LOCKFILE_NAME: undefined,
          YARN_RC_FILENAME: undefined,
          YARN_YARN_PATH: this.yarnPath,
        },
      });

      installProcess.log.append('Installing dependencies...');

      return new Promise<void>((resolve, reject) => {
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
          resolve();
        });
      });
    };

    let release: (() => Promise<void>) | undefined;
    try {
      await createStorageDir();
      release = await tryLock();
      if (release) {
        await perform();
      } else {
        await wait();
      }

      log(INSTALL_SUCCESS_MESSAGE);
    } catch (e) {
      const err =
        e instanceof Error ? e : new Error(`failed to install node dependencies: ${String(e)}`);
      log(`${err.stack}`);
      Telemetry.sendEvent(DEBUG_EXCEPTION, {
        exception: err,
        errorCode: ErrorCode.DependencyInstallFailure,
        log: logLines.join('\n'),
      });
    } finally {
      if (release) release(); // intentionally no waiting

      this._ready = true;
      this._onReady.fire();
    }
  }
}
