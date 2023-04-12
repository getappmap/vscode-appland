import { readFile, mkdir, appendFile } from 'fs/promises';
import { load } from 'js-yaml';
import { dirname, join } from 'path';
import assert from 'node:assert';
import * as vscode from 'vscode';

import { fileExists } from '../util';
import { DEBUG_EXCEPTION, Telemetry } from '../telemetry';
import { ConfigFileProvider } from './processWatcher';
import { AppMapConfigWatcher } from './appMapConfigWatcher';

export type AppmapConfig = {
  appmapDir: string;
  configFolder: string;
};

type WorkspaceConfig = {
  configs: AppmapConfig[];
  fileProvider: ConfigFileProviderImpl;
  pattern: vscode.RelativePattern;
  files: vscode.Uri[];
};

type WorkspaceConfigs = {
  workspace: WorkspaceConfig;
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

export class AppmapConfigManager {
  private static readonly CONFIG_PATTERN = '**/appmap.yml';
  public static readonly DEFAULT_APPMAP_DIR = '.';
  private static workspaceConfigs = {} as WorkspaceConfigs;
  private static _initialized = false;
  private static _usingDefault = new Set<string>();
  private static _configWatcher: AppMapConfigWatcher | undefined;
  private static _watcherConfigured = false;

  public static register(watcher: AppMapConfigWatcher): void {
    this._configWatcher = watcher;
  }

  public static async initialize() {
    const workspaceFolders = vscode.workspace.workspaceFolders || [];

    await Promise.all(
      workspaceFolders.map(async (folder) => {
        const workspaceConfig = await this.configForWorkspace(folder);

        this.workspaceConfigs[folder.uri.fsPath] = workspaceConfig;
        await this.makeAppmapDirs(workspaceConfig.configs);

        if (this._configWatcher) {
          await this._configWatcher?.create(folder);
        }
      })
    );
    this._initialized = true;
    this.setupWatcher();
  }

  public static async getWorkspaceConfig(folder: vscode.WorkspaceFolder): Promise<WorkspaceConfig> {
    if (!this._initialized) await this.initialize();
    return this.workspaceConfigs[folder.uri.fsPath];
  }

  public static async getAppmapConfigforWorkspace(
    folder: vscode.WorkspaceFolder
  ): Promise<AppmapConfig | undefined> {
    const { configs } = await this.getWorkspaceConfig(folder);
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

  public static async getAppmapDirForWorkspace(
    folder: vscode.WorkspaceFolder
  ): Promise<string | undefined> {
    return (await this.getAppmapConfigforWorkspace(folder))?.appmapDir;
  }

  public static isUsingDefaultConfig(projectPath: string): boolean {
    return this._usingDefault.has(projectPath);
  }

  public static async saveAppMapDir(folder: string, appmapDir: string): Promise<void> {
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
      await this.initialize();
    }
  }

  private static async configForWorkspace(
    folder: vscode.WorkspaceFolder
  ): Promise<WorkspaceConfig> {
    const configPattern = new vscode.RelativePattern(folder, AppmapConfigManager.CONFIG_PATTERN);
    const configFileProvider = new ConfigFileProviderImpl(configPattern);
    const configFiles = await configFileProvider.files();

    const appmapConfigCandidates = await Promise.all(
      configFiles.map(async (configFile) => {
        return await AppmapConfigManager.appMapConfigFromFile(configFile.fsPath);
      })
    );

    // remove configs without an appmap_dir
    let appmapConfigs = appmapConfigCandidates.filter(
      (appmapConfig) => appmapConfig && appmapConfig.appmapDir
    ) as Array<AppmapConfig>;

    if (appmapConfigs.length < 1) {
      appmapConfigs = [
        {
          appmapDir: AppmapConfigManager.DEFAULT_APPMAP_DIR,
          configFolder: folder.uri.fsPath,
          fileProvider: configFileProvider,
        } as AppmapConfig,
      ];
      this._usingDefault.add(folder.uri.fsPath);
    } else {
      this._usingDefault.delete(folder.uri.fsPath);
    }

    return {
      configs: appmapConfigs,
      fileProvider: configFileProvider,
      pattern: configPattern,
      files: configFiles,
    };
  }

  private static setupWatcher() {
    if (!this._configWatcher || this._watcherConfigured) return;

    this._configWatcher.onCreate(async ({ workspaceFolder, uri }) => {
      const newConfig = await this.appMapConfigFromFile(uri.fsPath);
      const currentWorkspaceConfig = this.workspaceConfigs[workspaceFolder.uri.fsPath];

      if (newConfig) currentWorkspaceConfig.configs.push(newConfig);
    });

    this._configWatcher.onDelete(({ workspaceFolder, uri }) => {
      const currentWorkspaceConfig = this.workspaceConfigs[workspaceFolder.uri.fsPath];

      currentWorkspaceConfig.configs = currentWorkspaceConfig.configs.filter(
        (config) => config.configFolder !== dirname(uri.fsPath)
      );
    });

    this._configWatcher.onChange(async ({ workspaceFolder, uri }) => {
      const newConfig = await this.appMapConfigFromFile(uri.fsPath);
      const currentWorkspaceConfig = this.workspaceConfigs[workspaceFolder.uri.fsPath];

      currentWorkspaceConfig.configs = currentWorkspaceConfig.configs.map((config) =>
        config.configFolder === newConfig?.configFolder ? newConfig : config
      );
    });
    this._watcherConfigured = true;
  }

  private static async makeAppmapDirs(configs: AppmapConfig[]): Promise<void> {
    await Promise.all(
      configs.map(async (appmapConfig) => {
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

  private static async appMapConfigFromFile(
    configFilePath: string
  ): Promise<AppmapConfig | undefined> {
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
}
