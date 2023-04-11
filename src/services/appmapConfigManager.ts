import { readFile, mkdir } from 'fs/promises';
import { load } from 'js-yaml';
import { dirname, join } from 'path';
import assert from 'node:assert';
import * as vscode from 'vscode';

import { fileExists } from '../util';
import { DEBUG_EXCEPTION, Telemetry } from '../telemetry';
import { ConfigFileProvider } from './processWatcher';

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

  public static async initialize() {
    const workspaceFolders = vscode.workspace.workspaceFolders || [];

    await Promise.all(
      workspaceFolders.map(async (folder) => {
        const configPattern = new vscode.RelativePattern(
          folder,
          AppmapConfigManager.CONFIG_PATTERN
        );

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

        if (appmapConfigs.length < 1)
          appmapConfigs = [
            {
              appmapDir: AppmapConfigManager.DEFAULT_APPMAP_DIR,
              configFolder: folder.uri.fsPath,
              fileProvider: configFileProvider,
            } as AppmapConfig,
          ];

        this.workspaceConfigs[folder.uri.fsPath] = {
          configs: appmapConfigs,
          fileProvider: configFileProvider,
          pattern: configPattern,
          files: configFiles,
        } as WorkspaceConfig;

        await this.makeAppmapDirs(appmapConfigs);
      })
    );
    this._initialized = true;
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
