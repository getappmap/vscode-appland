import { readFile, mkdir, writeFile } from 'fs/promises';
import { dump, load } from 'js-yaml';
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
  usingDefault?: boolean;
};

type WorkspaceConfig = {
  configs: AppmapConfig[];
  fileProvider: ConfigFileProviderImpl;
};

class ConfigFileProviderImpl implements ConfigFileProvider {
  private _files?: vscode.Uri[] = undefined;

  public constructor(private pattern: vscode.RelativePattern) {}

  public async files(): Promise<vscode.Uri[]> {
    if (this._files) {
      return this._files;
    }

    this._files = await vscode.workspace.findFiles(this.pattern);
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
  private _hasConfigFile = false;
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
    );
    assert(configWatcher);
    this._configWatcher = configWatcher;
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
    )
      .filter(Boolean)
      .filter((p) => !p?.configFolder.split('/').includes('node_modules')) as Array<AppmapConfig>;

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

  public get hasConfigFile(): boolean {
    return this._hasConfigFile;
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

  private setupWatcher(): void {
    if (this._watcherConfigured) return;

    const handleConfigChange = async () => {
      this._configFileProvider.reset();
      await this.update();
      this._onConfigChanged.fire();
    };

    this._configWatcher.onCreate(handleConfigChange);
    this._configWatcher.onDelete(handleConfigChange);
    this._configWatcher.onChange(handleConfigChange);

    this._watcherConfigured = true;
  }

  public dispose(): void {
    this._onConfigChanged.dispose();
    this._configWatcher.dispose();
    this._configFileProvider.reset();
    this._configs = [];
  }
}

export class AppmapConfigManager implements WorkspaceService<AppmapConfigManagerInstance> {
  public static readonly serviceId = 'AppmapConfigManager';
  public static readonly DEFAULT_APPMAP_DIR = 'tmp/appmap';

  public async create(folder: vscode.WorkspaceFolder): Promise<AppmapConfigManagerInstance> {
    const instance = new AppmapConfigManagerInstance(folder);
    return instance.initialize();
  }
}
