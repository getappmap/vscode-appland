import * as vscode from 'vscode';
import DefaultInstaller from './default';
import { InstallerAction } from '.';

export default class PythonInstaller extends DefaultInstaller {
  // these are in order of precedence
  private static readonly CONFIG_LOCATIONS = [
    'workspaceFolderLanguageValue',
    'workspaceLanguageValue',
    'globalLanguageValue',
    'defaultLanguageValue',
    'workspaceFolderValue',
    'workspaceValue',
    'globalValue',
    'defaultValue',
  ];

  canInstall(language: string): boolean {
    return language.toLowerCase() == 'python';
  }

  private static getActiveConfigLocation(
    config: vscode.WorkspaceConfiguration,
    scope: string
  ): string {
    const configInfo = config.inspect(scope) || {};
    const activeConfig = PythonInstaller.CONFIG_LOCATIONS.find((configLocation) => {
      const terminalSettings = configInfo[configLocation]?.terminal;
      return terminalSettings && Object.keys(terminalSettings).includes('activateEnvironment');
    });

    return activeConfig || '';
  }

  private static getConfigTargetFromConfigLocation(
    configLocation: string
  ): vscode.ConfigurationTarget | undefined {
    if (
      ['defaultValue', 'globalValue', 'globalLanguageValue', 'defaultLanguageValue'].includes(
        configLocation
      )
    ) {
      return vscode.ConfigurationTarget.Global;
    } else if (['workspaceValue', 'workspaceLanguageValue'].includes(configLocation)) {
      return vscode.ConfigurationTarget.Workspace;
    } else if (['workspaceFolderValue', 'workspaceFolderLanguageValue'].includes(configLocation)) {
      return vscode.ConfigurationTarget.WorkspaceFolder;
    }
  }

  async execute(
    cliCommand: string,
    projectPath: string,
    env?: { [key: string]: string | null | undefined } | undefined
  ): Promise<void> {
    const config = vscode.workspace.getConfiguration();
    const originalValue = config.get('python.terminal.activateEnvironment');

    if (originalValue) {
      const activePythonConfig = PythonInstaller.getActiveConfigLocation(config, 'python');
      const configTarget = PythonInstaller.getConfigTargetFromConfigLocation(activePythonConfig);
      await config.update('python.terminal.activateEnvironment', false, configTarget);
      this.createTerminal(cliCommand, projectPath, env);

      // restore settings to original state
      await config.update('python.terminal.activateEnvironment', originalValue, configTarget);
    } else {
      super.execute(cliCommand, projectPath, env);
    }
  }
}
