import { readFile, mkdir, appendFile } from 'fs/promises';
import { load } from 'js-yaml';
import { dirname, join } from 'path';
import assert from 'node:assert';
import * as vscode from 'vscode';

import { fileExists } from '../util';
import { DEBUG_EXCEPTION, Telemetry } from '../telemetry';
import { ConfigFileProvider } from './processWatcher';
import { AppMapConfigWatcher, AppMapConfigWatcherInstance } from './appMapConfigWatcher';
import { WorkspaceService, WorkspaceServiceInstance } from './workspaceService';
import { workspaceServices } from './workspaceServices';

export type AppmapConfig = {
  appmapDir: string;
  configFolder: string;
};

type WorkspaceConfig = {
  configs: AppmapConfig[];
  fileProvider: ConfigFileProviderImpl;
};

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

export class AppmapConfigManagerInstance implements WorkspaceServiceInstance {
  private readonly CONFIG_PATTERN = '**/appmap.yml';

  private _configs: AppmapConfig[] = [];
  private _configFileProvider: ConfigFileProviderImpl;
  private _configWatcher: AppMapConfigWatcherInstance;
  private _usingDefault = false;
  private _watcherConfigured = false;
  private _onConfigChanged = new vscode.EventEmitter<void>();
  public readonly onConfigChanged = this._onConfigChanged.event;

  constructor(public folder: vscode.WorkspaceFolder) {
    const configPattern = new vscode.RelativePattern(folder, this.CONFIG_PATTERN);
    this._configFileProvider = new ConfigFileProviderImpl(configPattern);
    const configWatcher = workspaceServices().getServiceInstanceFromClass(
      AppMapConfigWatcher,
      folder
    ) as AppMapConfigWatcherInstance | undefined;
    assert(configWatcher);
    this._configWatcher = configWatcher;
  }

  public async initialize(): Promise<AppmapConfigManagerInstance> {
    await this.update();
    return this;
  }

  private async update(): Promise<void> {
    const configFiles = await this._configFileProvider.files();

    const appmapConfigCandidates = await Promise.all(
      configFiles.map(async (configFile) => {
        return await this.appMapConfigFromFile(configFile.fsPath);
      })
    );

    // remove configs without an appmap_dir
    // might need to change if we expand the responsibilities of this class
    let appmapConfigs = appmapConfigCandidates.filter(
      (appmapConfig) => appmapConfig && appmapConfig.appmapDir
    ) as Array<AppmapConfig>;

    if (appmapConfigs.length < 1) {
      appmapConfigs = [
        {
          appmapDir: AppmapConfigManager.DEFAULT_APPMAP_DIR,
          configFolder: this.folder.uri.fsPath,
        } as AppmapConfig,
      ];
      this._usingDefault = true;
    } else {
      this._usingDefault = false;
    }

    this._configs = appmapConfigs;
    await this.makeAppmapDirs();
    this.setupWatcher();
  }

  public get workspaceConfig(): WorkspaceConfig {
    return {
      configs: this._configs,
      fileProvider: this._configFileProvider,
    };
  }

  public get isUsingDefaultConfig(): boolean {
    return this._usingDefault;
  }

  public async getAppmapConfig(): Promise<AppmapConfig | undefined> {
    const { configs } = this.workspaceConfig;
    let configToUse: AppmapConfig | undefined;

    if (configs.length === 1) {
      configToUse = configs[0];
    } else if (configs.length > 1) {
      const pick = await vscode.window.showQuickPick(
        configs.map((config) => config.configFolder),
        { canPickMany: false, title: 'Choose a folder: ' } as vscode.QuickPickOptions
      );

      configToUse = configs.find((config) => config.configFolder === pick);
    }

    return configToUse;
  }

  public async saveAppMapDir(folder: string, appmapDir: string): Promise<void> {
    const appmapConfigFilePath = join(folder, 'appmap.yml');

    if (await fileExists(appmapConfigFilePath)) {
      let appmapConfig: unknown;
      try {
        appmapConfig = load(await readFile(appmapConfigFilePath, 'utf-8'));
        assert(appmapConfig && typeof appmapConfig === 'object');
      } catch (e) {
        // Unparseable AppMap config, or related error.
        console.warn(e);
        return;
      }
      await appendFile(appmapConfigFilePath, `appmap_dir: ${appmapDir}`);
      await this.update();
    }
  }

  private async appMapConfigFromFile(configFilePath: string): Promise<AppmapConfig | undefined> {
    if (await fileExists(configFilePath)) {
      const result = {} as AppmapConfig;

      try {
        const appmapConfig = load(await readFile(configFilePath, 'utf-8'));
        assert(appmapConfig && typeof appmapConfig === 'object');

        result.configFolder = dirname(configFilePath);

        if ('appmap_dir' in appmapConfig && typeof appmapConfig.appmap_dir === 'string')
          result.appmapDir = appmapConfig.appmap_dir;

        return result;
      } catch {
        // Unparseable AppMap config, or related error.
      }
    }
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

  private setupWatcher(): void {
    if (this._watcherConfigured) return;

    this._configWatcher.onCreate(async ({ uri }) => {
      const newConfig = await this.appMapConfigFromFile(uri.fsPath);
      const currentWorkspaceConfig = this.workspaceConfig;

      if (newConfig) currentWorkspaceConfig.configs.push(newConfig);

      await this.update();
      this._onConfigChanged.fire();
    });

    this._configWatcher.onDelete(async ({ uri }) => {
      const currentWorkspaceConfig = this.workspaceConfig;

      currentWorkspaceConfig.configs = currentWorkspaceConfig.configs.filter(
        (config) => config.configFolder !== dirname(uri.fsPath)
      );

      await this.update();
      this._onConfigChanged.fire();
    });

    this._configWatcher.onChange(async ({ uri }) => {
      const newConfig = await this.appMapConfigFromFile(uri.fsPath);
      const currentWorkspaceConfig = this.workspaceConfig;

      currentWorkspaceConfig.configs = currentWorkspaceConfig.configs.map((config) =>
        config.configFolder === newConfig?.configFolder ? newConfig : config
      );

      await this.update();
      this._onConfigChanged.fire();
    });

    this._watcherConfigured = true;
  }

  dispose(): void {
    return;
  }
}

export class AppmapConfigManager implements WorkspaceService<AppmapConfigManagerInstance> {
  public static readonly DEFAULT_APPMAP_DIR = '.';

  public async create(folder: vscode.WorkspaceFolder): Promise<AppmapConfigManagerInstance> {
    const instance = new AppmapConfigManagerInstance(folder);
    return instance.initialize();
  }
}
