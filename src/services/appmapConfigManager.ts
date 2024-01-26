import { readFile, mkdir, writeFile } from 'fs/promises';
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
    this._files = await findFiles(this.pattern, this.exclusions);
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

  public readonly onConfigChanged = this._onConfigChanged.event;

  constructor(private configWatcher: Watcher, public folder: vscode.WorkspaceFolder) {
    const appmapignoreManager = new AppmapignoreManager(folder);
    const exclusions = appmapignoreManager.getExclusions();

    const configPattern = new vscode.RelativePattern(folder, this.CONFIG_PATTERN);
    this._configFileProvider = new ConfigFileProviderImpl(configPattern, exclusions);

    this._events = (['onChange', 'onCreate', 'onDelete'] as const).map((event) =>
      this.configWatcher[event]((uri) => this.handleConfigChange(uri))
    );
  }

  public async initialize(): Promise<AppmapConfigManagerInstance> {
    await this.update();
    return this;
  }

  private async update(): Promise<void> {
    const configFiles = await this._configFileProvider.files();
    this._hasConfigFile = configFiles.length > 0;

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

    this._configFileProvider.reset();
    await this.update();
    this._onConfigChanged.fire();
  }

  public dispose(): void {
    this._events.forEach((event) => event.dispose());
    this._onConfigChanged.dispose();
    this._configFileProvider.dispose();
    this._configs = [];
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
