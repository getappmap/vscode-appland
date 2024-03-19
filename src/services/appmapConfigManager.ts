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

class ConfigFileProviderImpl implements ConfigFileProvider {
  private _files?: vscode.Uri[] = undefined;

  public constructor(
    private pattern: vscode.RelativePattern,
    private exclusions: vscode.GlobPattern[] = []
  ) {}

  public async files(): Promise<vscode.Uri[]> {
    if (this._files) return this._files;

    this._files = this._files = await findFiles(this.pattern, this.exclusions);
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

export class AppmapConfigManagerInstance implements WorkspaceServiceInstance {
  private readonly CONFIG_PATTERN = '**/appmap.yml';

  private _events: vscode.Disposable[];
  private _configs: AppmapConfig[] = [];
  private _configFileProvider: ConfigFileProviderImpl;
  private _hasConfigFile = false;
  private _usingDefault = false;
  private _onConfigChanged = new vscode.EventEmitter<void>();
  private _configMtimes: Map<string, number> = new Map();
  private _pollInterval?: NodeJS.Timeout;

  public readonly onConfigChanged = this._onConfigChanged.event;

  constructor(private configWatcher: Watcher, public folder: vscode.WorkspaceFolder) {
    const appmapignoreManager = new AppmapignoreManager(folder);
    const exclusions = appmapignoreManager.getExclusions();

    const configPattern = new vscode.RelativePattern(folder, this.CONFIG_PATTERN);
    this._configFileProvider = new ConfigFileProviderImpl(configPattern, exclusions);

    this._events = (['onChange', 'onCreate', 'onDelete'] as const).map((event) =>
      this.configWatcher[event]((uri) => this.handleConfigChange(uri))
    );
    this._pollInterval = setInterval(() => this.poll(), 2_500);
  }

  public async initialize(): Promise<AppmapConfigManagerInstance> {
    await this.update();
    return this;
  }

  private async poll(): Promise<void> {
    const changes: Array<['change' | 'delete' | 'create', string]> = [];

    for (const [file, lastMtime] of this._configMtimes.entries()) {
      try {
        const stats = await stat(file);
        const mtime = stats.mtime.getTime();
        if (mtime > lastMtime) {
          this._configMtimes.set(file, mtime);
          changes.push(['change', file]);
        }
      } catch (e: unknown) {
        // File no longer exists.
        if (e instanceof Error && 'code' in e && e.code === 'ENOENT') {
          this._configMtimes.delete(file);
          changes.push(['delete', file]);
        } /* else {
          Let the configuration remain. It may be a transient error, such as EACCES
          due to Windows anti-virus.
        } */
      }
    }

    // Consider the case where an AppMap configuration file was moved via recursive directory rename.
    if (changes.some(([type]) => type === 'delete')) {
      const configFiles = await vscode.workspace.findFiles(
        this.CONFIG_PATTERN,
        vscode.workspace.getConfiguration('search').get('exclude')
      );
      NodeProcessService.outputChannel.appendLine(configFiles.map((uri) => uri.fsPath).join('\n'));
      configFiles.forEach((uri) => {
        if (!this._configMtimes.has(uri.fsPath)) {
          this._configMtimes.set(uri.fsPath, 0);
          changes.push(['create', uri.fsPath]);
        }
      });
    }

    if (changes.length) {
      NodeProcessService.outputChannel.appendLine(
        [
          'AppMap configuration out of sync. The following changes will be resynchronized:',
          changes.map(([type, file]) => `- ${file} (${type})`).join('\n'),
        ].join('\n')
      );

      this._configFileProvider.reset();
      await this.update();
      this._onConfigChanged.fire();
    }
  }

  private async update(): Promise<void> {
    const configFiles = await this._configFileProvider.files();
    this._hasConfigFile = configFiles.length > 0;

    // Make sure baseline stats are up to date
    // If this was called from the file watcher, we want to make sure the poller
    // doesn't immediately re-trigger a change event.
    for (const configFile of configFiles) {
      try {
        const stats = await stat(configFile.fsPath);
        this._configMtimes.set(configFile.fsPath, stats.mtime.getTime());
      } catch (e) {
        if (e instanceof Error && 'code' in e && e.code === 'EACCES') {
          this._configMtimes.set(configFile.fsPath, 0);
        }
      }
    }

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
      await this.update();
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
        try {
          await mkdir(join(appmapConfig.configFolder, appmapConfig.appmapDir), {
            recursive: true,
          });
        } catch (e) {
          Telemetry.sendEvent(DEBUG_EXCEPTION, {
            exception: new Error('Failed to create appmap_dir: ' + String(e)),
          });
        }
      })
    );
  }

  protected async handleConfigChange(uri: vscode.Uri) {
    const folder = vscode.workspace.getWorkspaceFolder(uri);
    if (folder !== this.folder) return;

    try {
      const stats = await stat(uri.fsPath);
      this._configMtimes.set(uri.fsPath, stats.mtime.getTime());
    } catch (e) {
      let handled = false;
      if (e instanceof Error && 'code' in e) {
        if (e.code === 'ENOENT') {
          this._configMtimes.delete(uri.fsPath);
          handled = true;
        } else if (e.code === 'EACCES') {
          // File is inaccessible, likely due to Windows anti-virus.
          // Setting the mtime to 0 will cause the file to be rechecked on the next poll.
          this._configMtimes.set(uri.fsPath, 0);
          return;
        }
      }

      if (!handled) {
        NodeProcessService.outputChannel.appendLine(
          `Failed to handle AppMap configuration change for ${uri.fsPath}: `
        );
        NodeProcessService.outputChannel.appendLine(String(e));
      }
    }

    this._configFileProvider.reset();
    await this.update();
    this._onConfigChanged.fire();
  }

  public dispose(): void {
    this._events.forEach((event) => event.dispose());
    this._onConfigChanged.dispose();
    this._configFileProvider.dispose();
    this._configs = [];
    clearInterval(this._pollInterval);
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
