import { createWriteStream, promises as fs } from 'fs';
import os from 'os';
import * as path from 'path';
import lockfile from 'proper-lockfile';
import * as vscode from 'vscode';
import Environment from '../configuration/environment';
import { AppMapConfig, appMapConfigFromFile } from '../lib/appmapDir';
import { DEBUG_EXCEPTION, Telemetry } from '../telemetry';
import ErrorCode from '../telemetry/definitions/errorCodes';
import { downloadFile, getLatestVersionInfo } from '../util';
import ChangeEventDebouncer from './changeEventDebouncer';
import IndexProcessWatcher from './indexProcessWatcher';
import { getModulePath, ProgramName, spawn } from './nodeDependencyProcess';
import NodeProcessServiceInstance from './nodeProcessServiceInstance';
import { ConfigFileProvider, ProcessWatcher } from './processWatcher';
import ScanProcessWatcher from './scanProcessWatcher';
import { WorkspaceService } from './workspaceService';

const YARN_JS = 'yarn.js';
const PACKAGE_JSON = 'package.json';
const INSTALL_SUCCESS_MESSAGE = 'Installation of AppMap services is complete.';

class ConfigFileProviderImpl implements ConfigFileProvider {
  private _files?: vscode.Uri[] = undefined;
  private exclude: vscode.RelativePattern;

  public constructor(private pattern: vscode.RelativePattern) {
    const excludes = vscode.workspace
      .getConfiguration('files')
      .get<{ [pattern: string]: boolean }>('watcherExclude', {});

    this.exclude = new vscode.RelativePattern(pattern.base, `{${Object.keys(excludes).join(',')}}`);
  }

  public async files(): Promise<vscode.Uri[]> {
    if (this._files) {
      return this._files;
    }

    this._files = await vscode.workspace.findFiles(this.pattern, this.exclude);
    return this._files;
  }

  public reset() {
    this._files = undefined;
  }
}
export class NodeProcessService implements WorkspaceService<NodeProcessServiceInstance> {
  public static outputChannel = vscode.window.createOutputChannel('AppMap: Services');

  protected externDir: string;
  protected globalStorageDir: string;
  protected COPY_FILES: string[] = [PACKAGE_JSON, YARN_JS];
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
    const services: ProcessWatcher[] = [];

    const configPattern = new vscode.RelativePattern(folder, `**/appmap.yml`);
    const configFileProvider = new ConfigFileProviderImpl(configPattern);
    const configFiles = await configFileProvider.files();

    const appmapConfigCandidates = await Promise.all(
      configFiles.map(async (configFile) => {
        return await appMapConfigFromFile(configFile.fsPath);
      })
    );

    // remove invalid appmap-dirs
    let appmapConfigs = appmapConfigCandidates.filter(
      (appmapConfig) => appmapConfig && appmapConfig.appmapDir
    ) as Array<AppMapConfig>;

    if (appmapConfigs.length < 1)
      appmapConfigs = [
        {
          appmapDir: NodeProcessService.DEFAULT_APPMAP_DIR,
          configFolder: folder.uri.fsPath,
        } as AppMapConfig,
      ];

    await Promise.all(
      appmapConfigs.map(async (appmapConfig) => {
        try {
          await fs.mkdir(path.join(appmapConfig.configFolder, appmapConfig.appmapDir), {
            recursive: true,
          });
        } catch (e) {
          Telemetry.sendEvent(DEBUG_EXCEPTION, {
            exception: new Error('Failed to create appmap_dir: ' + String(e)),
          });
        }
      })
    );

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

    const restartServices = () => {
      configFileProvider.reset();
      services.forEach((service) => {
        service.restart();
      });
    };

    const configFileEvent = new ChangeEventDebouncer<vscode.Uri>(1000);
    const watcher = vscode.workspace.createFileSystemWatcher(configPattern);

    const files = new Set<string>(configFiles.map((uri: vscode.Uri) => uri.fsPath));
    const cloneFiles = () => [...files];
    const addFile = (uri: vscode.Uri) => files.add(uri.fsPath);
    const removeFile = (uri: vscode.Uri) => files.delete(uri.fsPath);

    this.context.subscriptions.push(
      watcher,
      watcher.onDidChange((e) => {
        const oldFiles = cloneFiles();
        addFile(e);
        if (oldFiles.join('\n') !== [...files].join('\n')) configFileEvent.fire(e);
      }),
      watcher.onDidCreate((e) => {
        const oldFiles = cloneFiles();
        addFile(e);
        if (oldFiles.join('\n') !== [...files].join('\n')) configFileEvent.fire(e);
      }),
      watcher.onDidDelete((e) => {
        const oldFiles = cloneFiles();
        removeFile(e);
        if (oldFiles.join('\n') !== [...files].join('\n')) configFileEvent.fire(e);
      })
    );
    configFileEvent.event(restartServices);

    const instance = new NodeProcessServiceInstance(folder, services);
    instance.initialize();

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
