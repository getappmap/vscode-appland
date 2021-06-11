import * as vscode from 'vscode';
import { promises as fs } from 'fs';
import { promisify } from 'util';
import { exec as execCallback } from 'child_process';
import { default as LanguageConfiguration } from './languageConfiguration';

const exec = promisify(execCallback);
const VERSION_UNSPECIFIED = 'none';

export default class LanguageConfigurationRuby implements LanguageConfiguration {
  private static readonly CONFIG_FILES = ['Gemfile.lock'];
  private static readonly REGEX_GEM = /^\s*appmap\s+\((.*)\)$/m;

  public async getAppMapAgentVersionLocal(): Promise<string> {
    const configUris = (
      await Promise.all(
        LanguageConfigurationRuby.CONFIG_FILES.flatMap(
          async (configPath) => await vscode.workspace.findFiles(configPath)
        )
      )
    ).flat();

    const results = await Promise.all(
      configUris.map(async (configUri) => {
        const config = await fs.readFile(configUri.fsPath);
        const match = String(config).match(LanguageConfigurationRuby.REGEX_GEM);
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

    const match = stdout.match(LanguageConfigurationRuby.REGEX_GEM);
    return match ? match[1] : VERSION_UNSPECIFIED;
  }
}
