import { readFile, mkdir, writeFile, stat } from 'fs/promises';
import { readFileSync } from 'fs';
import { dump, load } from 'js-yaml';
import { dirname, join } from 'path';
import assert from 'node:assert';
import * as vscode from 'vscode';

import { fileExists } from '../util';
import { DEBUG_EXCEPTION, Telemetry } from '../telemetry';
import { ConfigFileProvider } from './processWatcher';
import { WorkspaceService, WorkspaceServiceInstance } from './workspaceService';
import Watcher from './watcher';
import { findFiles } from '../lib/findFiles';
import { NodeProcessService } from './nodeProcessService';
import { filterConfigFiles, isInExcludedDirectory } from './configFileFilter';

export type AppmapConfig = {
  appmapDir: string;
  configFolder: string;
  usingDefault?: boolean;
};

export class AppmapignoreManager {
  private _exclusions: vscode.GlobPattern[] = [];

  constructor(private folder: vscode.WorkspaceFolder) {}

  public getExclusions(): vscode.GlobPattern[] {
    if (this._exclusions.length === 0) {
      this._exclusions = this.readExclusions() || [];
    }
    return this._exclusions;
  }

  private readExclusions(): vscode.GlobPattern[] | undefined {
    const filePath = join(this.folder.uri.fsPath, '.appmapignore');
    let fileContent: string;
    try {
      fileContent = readFileSync(filePath, 'utf-8');
    } catch (e) {
      return;
    }

    if (!fileContent) return;

    return fileContent
      .split('\n')
      .map((line: string) => this.convertToGlob(line.trim()))
      .filter((pattern: string) => pattern.length > 0);
  }

  private convertToGlob(pattern: string): string {
    let result = pattern;

    if (pattern.length === 0 || pattern.startsWith('#')) {
      return '';
    } else if (pattern.startsWith('/')) {
      result = pattern.slice(1);
    } else {
      result = '**/' + pattern;
    }

    if (pattern.endsWith('/')) {
      result = result.slice(0, -1);
    }

    return result;
  }
}

// Glob patterns the editor itself hides from search and the explorer, in this folder (a
// multi-root workspace can set them per folder).
function editorExcludePatterns(folder: vscode.WorkspaceFolder): vscode.GlobPattern[] {
  const patterns: string[] = [];
  for (const section of ['files.exclude', 'search.exclude']) {
    const [scope, key] = section.split('.');
    const value = vscode.workspace
      .getConfiguration(scope, folder.uri)
      .get<Record<string, unknown>>(key);
    if (!value) continue;
    for (const [pattern, enabled] of Object.entries(value))
      if (enabled === true) patterns.push(pattern);
  }
  return patterns;
}

class ConfigFileProviderImpl implements ConfigFileProvider {
  private _files?: vscode.Uri[] = undefined;

  public constructor(
    private folder: vscode.WorkspaceFolder,
    private pattern: vscode.RelativePattern,
    private exclusions: vscode.GlobPattern[] = []
  ) {}

  public async files(): Promise<vscode.Uri[]> {
    if (this._files) return this._files;

    const found = await findFiles(this.pattern, this.exclusions);
    let kept: Set<string>;
    try {
      kept = new Set(
        await filterConfigFiles(
          this.folder.uri.fsPath,
          found.map((uri) => uri.fsPath)
        )
      );
    } catch (e) {
      // Filtering is a refinement. Should it fail on some setup nobody foresaw, use every
      // file found, as before there was a filter, rather than none.
      NodeProcessService.outputChannel.appendLine(
        `Failed to filter AppMap configuration files in ${this.folder.uri.fsPath}, ` +
          `using all of them: ${String(e)}`
      );
      kept = new Set(found.map((uri) => uri.fsPath));
    }
    this._files = found.filter((uri) => kept.has(uri.fsPath));
    return this._files;
  }

  public reset() {
    this._files = undefined;
  }

  public dispose() {
    this.reset();
    this.exclusions = [];
  }
}

function reportAppmapDirFailure(dir: string, configFolder: string, error: unknown): void {
  const { code, path } = (error ?? {}) as NodeJS.ErrnoException;
  NodeProcessService.outputChannel.appendLine(`Failed to create ${dir}: ${String(error)}`);
  // Just the code, and no stack: the error's message has the user's paths in it, and the
  // stack the extension's install path, which can be in their home directory.
  const exception = new Error(`Failed to create appmap_dir: ${code ?? 'unknown error'}`);
  exception.stack = undefined;
  Telemetry.sendEvent(DEBUG_EXCEPTION, { exception });

  // mkdir fails on the first folder it can't create, so it's that folder's parent which
  // can't be written to; often it belongs to root, for example made by a container.
  const reason =
    (code === 'EACCES' || code === 'EPERM') && path
      ? `you don't have permission to write to ${dirname(path)}. Fix its permissions or ownership`
      : `${error instanceof Error ? error.message : String(error)}. Fix this`;
  void vscode.window.showWarningMessage(
    `AppMap can't create ${dir} to store AppMaps: ${reason}, or set appmap_dir in ` +
      `${join(configFolder, 'appmap.yml')} to another folder.`
  );
}

export class AppmapConfigManagerInstance implements WorkspaceServiceInstance {
  private readonly CONFIG_PATTERN = '**/appmap.yml';

  private _events: vscode.Disposable[];
  private _configs: AppmapConfig[] = [];
  private _configFileProvider: ConfigFileProviderImpl;
  private _hasConfigFile = false;
  private _usingDefault = false;
  private _onConfigChanged = new vscode.EventEmitter<void>();
  private _configMtimes: Map<string, number> = new Map();
  // appmap_dir folders whose creation failed and has not succeeded since.
  private _failedAppmapDirs = new Set<string>();
  private _pollTimeout?: NodeJS.Timeout;
  private _disposed = false;
  // Config scans and change handling run one at a time, in the order they were requested.
  // Otherwise a burst of watcher events (for example the initial scan reporting every
  // existing file) can run several updates at once and fire several change events.
  private _queue: Promise<void> = Promise.resolve();

  public readonly onConfigChanged = this._onConfigChanged.event;

  constructor(private configWatcher: Watcher, public folder: vscode.WorkspaceFolder) {
    const appmapignoreManager = new AppmapignoreManager(folder);
    const exclusions = [...appmapignoreManager.getExclusions(), ...editorExcludePatterns(folder)];

    const configPattern = new vscode.RelativePattern(folder, this.CONFIG_PATTERN);
    this._configFileProvider = new ConfigFileProviderImpl(folder, configPattern, exclusions);

    this._events = (['onChange', 'onCreate', 'onDelete'] as const).map((event) =>
      this.configWatcher[event]((uri) => void this.enqueue(() => this.handleConfigChange(uri)))
    );
    this.schedulePoll();
  }

  public async initialize(): Promise<AppmapConfigManagerInstance> {
    await this.enqueue(() => this.update());
    return this;
  }

  // Runs the task after every task queued before it, unless the instance has been disposed by
  // then (a late update would only recreate appmap directories in a folder that has gone).
  // The returned promise carries the task's own outcome; the queue itself never stalls on a
  // failure.
  private enqueue(task: () => Promise<void>): Promise<void> {
    const runTask = () => (this._disposed ? Promise.resolve() : task());
    const run = this._queue.then(runTask, runTask);
    this._queue = run.catch((e) => {
      NodeProcessService.outputChannel.appendLine(
        `Failed to update AppMap configuration for ${this.folder.uri.fsPath}: ${String(e)}`
      );
    });
    return run;
  }

  // Polls 2.5 seconds after the previous poll finished, so that polls cannot pile up in the
  // queue behind a slow update.
  private schedulePoll(): void {
    this._pollTimeout = setTimeout(() => {
      const next = () => {
        if (!this._disposed) this.schedulePoll();
      };
      void this.enqueue(() => this.poll()).then(next, next);
    }, 2_500);
  }

  private async poll(): Promise<void> {
    const changes: string[] = [];
    for (const [file, lastMtime] of this._configMtimes) {
      try {
        if ((await stat(file)).mtime.getTime() > lastMtime) changes.push(`- ${file} (change)`);
      } catch (e: unknown) {
        if (e instanceof Error && 'code' in e && e.code === 'ENOENT')
          changes.push(`- ${file} (delete)`);
        // Anything else may be transient, such as EACCES due to Windows anti-virus.
      }
    }
    if (changes.length === 0) return;

    NodeProcessService.outputChannel.appendLine(
      [
        'AppMap configuration out of sync. The following changes will be resynchronized:',
        ...changes,
      ].join('\n')
    );
    // A rescan also finds the new home of a config file moved by a directory rename.
    await this.resync();
  }

  // Rescan the config files, and announce a change when the files in use, any of their
  // modification times, or what they say are not what they were. (What they say, because a
  // filesystem with coarse timestamps can give a rewrite the time the file already had.) This is the one place that decides whether
  // the configuration changed, so the watcher and the poller can never disagree with the
  // file filter about it.
  private async resync(): Promise<void> {
    const before = this._configMtimes;
    const configsBefore = JSON.stringify(this._configs);
    this._configFileProvider.reset();
    await this.update();
    const after = this._configMtimes;
    if (
      after.size !== before.size ||
      [...after].some(([file, mtime]) => before.get(file) !== mtime) ||
      JSON.stringify(this._configs) !== configsBefore
    )
      this._onConfigChanged.fire();
  }

  private async update(): Promise<void> {
    const configFiles = await this._configFileProvider.files();
    this._hasConfigFile = configFiles.length > 0;

    // Record the modification times of exactly the files in use: the poller watches those, and
    // the watcher's report of a file at a time already recorded is not news.
    const mtimes = new Map<string, number>();
    for (const { fsPath } of configFiles) {
      try {
        mtimes.set(fsPath, (await stat(fsPath)).mtime.getTime());
      } catch (e) {
        // Inaccessible for now, likely due to Windows anti-virus. Keep what we knew, or 0 so
        // that the poller looks again.
        if (e instanceof Error && 'code' in e && e.code === 'EACCES')
          mtimes.set(fsPath, this._configMtimes.get(fsPath) ?? 0);
      }
    }
    this._configMtimes = mtimes;

    let appmapConfigs = (
      await Promise.all(
        configFiles.map(async (configFile) => {
          return await this.appMapConfigFromFile(configFile.fsPath);
        })
      )
    ).filter(Boolean) as Array<AppmapConfig>;

    if (this._hasConfigFile && appmapConfigs.length === 0) {
      appmapConfigs = [
        {
          appmapDir: AppmapConfigManager.DEFAULT_APPMAP_DIR,
          configFolder: this.folder.uri.fsPath,
          usingDefault: true,
        } as AppmapConfig,
      ];
      this._usingDefault = true;
    } else {
      this._usingDefault = false;
    }

    this._configs = appmapConfigs;
    await this.makeAppmapDirs();
  }

  public get workspaceConfigs(): AppmapConfig[] {
    return this._configs;
  }

  public get isUsingDefaultConfig(): boolean {
    return this._usingDefault;
  }

  public get hasConfigFile(): boolean {
    return this._hasConfigFile;
  }

  public async getAppmapConfig(): Promise<AppmapConfig | undefined> {
    const configs = this.workspaceConfigs;
    let configToUse: AppmapConfig | undefined;

    if (configs.length === 1) {
      configToUse = configs[0];
    } else if (configs.length > 1) {
      const pick = await vscode.window.showQuickPick(
        configs.map((config) => config.configFolder),
        { canPickMany: false, title: 'Choose a folder: ' } as vscode.QuickPickOptions
      );

      if (!pick) return;
      configToUse = configs.find((config) => config.configFolder === pick);
    }

    return configToUse;
  }

  public async saveAppMapDir(configFolder: string, appmapDir: string): Promise<void> {
    const appmapConfigFilePath = join(configFolder, 'appmap.yml');

    if (await fileExists(appmapConfigFilePath)) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let appmapConfig: any;
      try {
        appmapConfig = load(await readFile(appmapConfigFilePath, 'utf-8'));
        assert(appmapConfig && typeof appmapConfig === 'object');
      } catch (e) {
        // Unparseable AppMap config, or related error.
        console.warn(e);
        return;
      }
      appmapConfig.appmap_dir = appmapDir;
      await writeFile(appmapConfigFilePath, dump(appmapConfig));
      // Announced like any other change, so that the services pick up the new directory. Left
      // to the watcher, the write would arrive with its time already recorded, as no news.
      await this.enqueue(() => this.resync());
    }
  }

  private async appMapConfigFromFile(configFilePath: string): Promise<AppmapConfig | undefined> {
    const result = {
      configFolder: dirname(configFilePath),
      appmapDir: AppmapConfigManager.DEFAULT_APPMAP_DIR,
      usingDefault: true,
    } as AppmapConfig;

    let appmapConfig: unknown;
    try {
      appmapConfig = load(await readFile(configFilePath, 'utf-8'));
    } catch (e) {
      // Unparseable AppMap config, or related error.
      console.warn(e);
      return;
    }

    if (
      appmapConfig &&
      typeof appmapConfig === 'object' &&
      'appmap_dir' in appmapConfig &&
      typeof appmapConfig.appmap_dir === 'string'
    ) {
      result.appmapDir = appmapConfig.appmap_dir;
      result.usingDefault = false;
    }

    return result;
  }

  private async makeAppmapDirs(): Promise<void> {
    await Promise.all(
      this._configs.map(async (appmapConfig) => {
        const dir = join(appmapConfig.configFolder, appmapConfig.appmapDir);
        try {
          await mkdir(dir, { recursive: true });
          this._failedAppmapDirs.delete(dir);
        } catch (e) {
          // Every update tries again, but a failure is only reported the first time.
          if (this._failedAppmapDirs.has(dir)) return;
          this._failedAppmapDirs.add(dir);
          reportAppmapDirFailure(dir, appmapConfig.configFolder, e);
        }
      })
    );
  }

  protected async handleConfigChange(uri: vscode.Uri) {
    const folder = vscode.workspace.getWorkspaceFolder(uri);
    if (folder !== this.folder) return;

    // The file filter drops these before anything else, so they can never change the set.
    if (isInExcludedDirectory(this.folder.uri.fsPath, uri.fsPath)) return;

    // The watcher reporting a file in use at the time already recorded for it (as its initial
    // scan does for every existing file) is not news.
    const known = this._configMtimes.get(uri.fsPath);
    if (known !== undefined) {
      try {
        if ((await stat(uri.fsPath)).mtime.getTime() <= known) return;
      } catch {
        // Gone or unreadable; the rescan decides what that means.
      }
    }

    await this.resync();
  }

  public dispose(): void {
    this._events.forEach((event) => event.dispose());
    this._onConfigChanged.dispose();
    this._configFileProvider.dispose();
    this._configs = [];
    this._disposed = true;
    clearTimeout(this._pollTimeout);
  }
}

export class AppmapConfigManager implements WorkspaceService<AppmapConfigManagerInstance> {
  public static readonly serviceId = 'AppmapConfigManager';
  public static readonly DEFAULT_APPMAP_DIR = 'tmp/appmap';

  constructor(private configWatcher: Watcher) {}

  public async create(folder: vscode.WorkspaceFolder): Promise<AppmapConfigManagerInstance> {
    const instance = new AppmapConfigManagerInstance(this.configWatcher, folder);
    return instance.initialize();
  }
}
