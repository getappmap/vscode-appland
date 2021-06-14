import * as vscode from 'vscode';
import { PathLike, promises as fs } from 'fs';
import { promisify } from 'util';
import { basename } from 'path';
import { exec as execCallback } from 'child_process';
import { default as ProjectConfiguration } from './projectConfiguration';

const exec = promisify(execCallback);
const VERSION_UNSPECIFIED = 'none';

export default class ProjectConfigurationRuby implements ProjectConfiguration {
  private static readonly CONFIG_FILES = ['Gemfile.lock'];
  private static readonly REGEX_GEM = /^\s*appmap\s+\((.*)\)$/m;

  public async getAppMapAgentVersionLocal(): Promise<string> {
    const configUris = (
      await Promise.all(
        ProjectConfigurationRuby.CONFIG_FILES.flatMap(
          async (configPath) => await vscode.workspace.findFiles(configPath)
        )
      )
    ).flat();

    const results = await Promise.all(
      configUris.map(async (configUri) => {
        const config = await fs.readFile(configUri.fsPath);
        const match = String(config).match(ProjectConfigurationRuby.REGEX_GEM);
        return match ? match[1] : undefined;
      })
    );

    return results.find(Boolean) || VERSION_UNSPECIFIED;
  }

  public async getAppMapAgentVersionGlobal(): Promise<string> {
    let stdout;

    try {
      ({ stdout } = await exec('gem list'));
    } catch (e) {
      return VERSION_UNSPECIFIED;
    }

    const match = stdout.match(ProjectConfigurationRuby.REGEX_GEM);
    return match ? match[1] : VERSION_UNSPECIFIED;
  }

  public isConfigurationFile(filePath: PathLike): boolean {
    return basename(filePath as string) === 'Gemfile';
  }

  public getLanguage(): string {
    return 'ruby';
  }
}
