import { createWriteStream, promises as fs } from 'fs';
import os from 'os';
import * as path from 'path';
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
import { AppmapConfigManager } from './appmapConfigManager';
import { workspaceServices } from './workspaceServices';
import assert from 'assert';
import LockfileSynchronizer, {
  LockfileStatusError,
  TimeoutError,
} from '../lib/lockfileSynchronizer';

const YARN_JS = 'yarn.js';
const PACKAGE_JSON = 'package.json';
const INSTALL_SUCCESS_MESSAGE = 'Installation of AppMap services is complete.';

export class NodeProcessService implements WorkspaceService<NodeProcessServiceInstance> {
  public static readonly serviceId = 'NodeProcessService';
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
    );
    assert(configManagerInstance);

    configManagerInstance.onConfigChanged(async () => this.handleConfigChange(folder));

    return instance;
  }

  private async handleConfigChange(folder: vscode.WorkspaceFolder): Promise<void> {
    const currentInstance = workspaceServices().getServiceInstanceFromClass(
      NodeProcessService,
      folder
    );
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
    );
    assert(appmapConfigManagerInstance);

    const appmapConfigs = appmapConfigManagerInstance.workspaceConfigs;

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

    const perform = async () => {
      log(`Performing tools installation in ${storagePath}...`);

      const httpProxy = vscode.workspace.getConfiguration('http').get<string>('proxy');
      if (httpProxy) {
        try {
          const { protocol, hostname, port } = new URL(httpProxy);
          const sanitizedProxy = `${protocol}//${hostname}:${port}`;
          log(
            `Using HTTP(s) proxy from Visual Studio Code http.proxy setting -> ${sanitizedProxy} (this URL has been sanitized)`
          );
        } catch (e) {
          log('Using HTTP(s) proxy from Visual Studio Code http.proxy setting');
        }
      }

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
          YARN_HTTP_PROXY: httpProxy,
          YARN_HTTPS_PROXY: httpProxy,
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

    await createStorageDir();

    const sync = new LockfileSynchronizer(this.globalStorageDir);
    await sync
      .on('wait', () => {
        log('Another process is currently installing dependencies. Waiting...');
      })
      .on('error', (err) => {
        if (err instanceof LockfileStatusError) {
          log('An unexpected error occurred while checking the installation status:');
          log(String(err));
          Telemetry.sendEvent(DEBUG_EXCEPTION, {
            exception: err,
            errorCode: ErrorCode.DependencyLockFailure,
            log: logLines.join('\n'),
          });
        } else if (err instanceof TimeoutError) {
          log('Giving up waiting for installation to finish.');
          log(String(err));
        } else {
          const e =
            err instanceof Error
              ? err
              : new Error(`failed to install node dependencies: ${String(err)}`);
          log(`${err.stack}`);
          Telemetry.sendEvent(DEBUG_EXCEPTION, {
            exception: e,
            errorCode: ErrorCode.DependencyInstallFailure,
            log: logLines.join('\n'),
          });
        }
      })
      .on('success', () => {
        log(INSTALL_SUCCESS_MESSAGE);
      })
      .execute(perform);

    this._ready = true;
    this._onReady.fire();
  }
}
