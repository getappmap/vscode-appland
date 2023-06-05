import * as vscode from 'vscode';
import type { IExtensionApi as PythonExtension } from '../../../types/ms-python';
import DefaultInstaller from './default';
import { INSTALL_BUTTON_ABORT, Telemetry } from '../../telemetry';

export default class PythonInstaller extends DefaultInstaller {
  // These are in order of precedence
  private static readonly ConfigLocations = [
    'workspaceFolderLanguageValue',
    'workspaceLanguageValue',
    'globalLanguageValue',
    'defaultLanguageValue',
    'workspaceFolderValue',
    'workspaceValue',
    'globalValue',
    'defaultValue',
  ];
  public static readonly PythonExtensionId = 'ms-python.python';
  public static readonly PythonConfigActivate = 'python.terminal.activateEnvironment';

  // Utility method to get the Python extension. If the extension was installed during this session,
  // `getExtension` won't resolve it, so we additionally check for its presence elsewhere.
  get pythonExtensionLoader(): vscode.Extension<PythonExtension> | undefined {
    return (
      vscode.extensions.getExtension(PythonInstaller.PythonExtensionId) ||
      vscode.extensions.all.find((extension) => extension.id === PythonInstaller.PythonExtensionId)
    );
  }

  // This is a utility method to determine where the given configuration (scope) has been modified.
  private static getActiveConfigTarget(
    config: vscode.WorkspaceConfiguration,
    scope: string
  ): vscode.ConfigurationTarget | undefined {
    const configInfo = config.inspect(scope) || {};
    const activeConfig = PythonInstaller.ConfigLocations.find(
      (configLocation) => typeof configInfo[configLocation] !== 'undefined'
    );

    switch (activeConfig) {
      case 'defaultValue':
      case 'globalValue':
      case 'globalLanguageValue':
      case 'defaultLanguageValue':
        return vscode.ConfigurationTarget.Global;

      case 'workspaceValue':
      case 'workspaceLanguageValue':
        return vscode.ConfigurationTarget.Workspace;

      case 'workspaceFolderValue':
      case 'workspaceFolderLanguageValue':
        return vscode.ConfigurationTarget.WorkspaceFolder;

      default:
        return undefined;
    }
  }

  // The Python extension has a setting that controls whether the extension
  // automatically activates the Python environment in the terminal.
  // This setting is enabled by default, but we want to guarantee that it's
  // enabled when we run the AppMap CLI.
  // This method temporarily enables the setting, runs the callback, and then
  // restores the setting to its original value.
  public static async withActiveEnvironment(cb: () => Promise<void>): Promise<void> {
    const config = vscode.workspace.getConfiguration();
    const originalValue = config.get(this.PythonConfigActivate);
    if (originalValue === undefined || originalValue === true) return await cb();

    const configTarget = PythonInstaller.getActiveConfigTarget(config, this.PythonConfigActivate);
    if (!configTarget) return await cb();

    // Toggle the setting to true, run the callback, and then toggle it back.
    // It's important that we're modifying the same setting edited by the user,
    // otherwise by doing this we'd risk adding files to the project (e.g. .vscode/settings.json).
    await config.update(this.PythonConfigActivate, true, configTarget);
    await cb();
    await config.update('python.terminal.activateEnvironment', originalValue, configTarget);
  }

  async canInstall(language: string): Promise<boolean> {
    return language.toLowerCase() === 'python';
  }

  // Perform the installation
  async execute(
    cliCommand: string,
    projectPath: string,
    env?: { [key: string]: string | null | undefined }
  ): Promise<void> {
    if (!this.pythonExtensionLoader) {
      const result = await vscode.window.showInformationMessage(
        `The AppMap extension requires the Microsoft Python extension, but you don't have it yet. Would you like to install it now?`,
        'Yes',
        'No'
      );

      // Open the extension page
      if (result === 'Yes') {
        vscode.commands.executeCommand('workbench.extensions.action.showExtensionsWithIds', [
          PythonInstaller.PythonExtensionId,
        ]);
      }

      Telemetry.sendEvent(INSTALL_BUTTON_ABORT, {
        reason: 'Python extension not installed',
        result: result === 'Yes' ? 'install' : 'abort',
      });

      return;
    }

    // I'm not sure this is necessary, but it seems like a good idea to check
    // that the Python extension is active before we rely on it to configure
    // the user's terminal.
    if (!this.pythonExtensionLoader.isActive) {
      await this.pythonExtensionLoader.activate();
    }

    // The Python extension provides a secondary promise that resolves once all
    // parts of the extension are loaded.
    await this.pythonExtensionLoader.exports.ready;

    await PythonInstaller.withActiveEnvironment(async () => {
      const terminal = vscode.window.createTerminal({
        name: 'install-appmap',
        cwd: projectPath,
        env,
      });

      terminal.show();

      // Wait for the terminal to be ready before sending the command.
      // Sometimes the terminal is not ready immediately after being created.
      // Sometimes the Python extension is sending commands to the terminal.
      // 1s should be enough to avoid both of these issues.
      await new Promise((resolve) => setTimeout(resolve, 1000));

      terminal.sendText(cliCommand);
    });
  }
}
