import * as vscode from 'vscode';
import type { EnvironmentPath, IExtensionApi as PythonExtension } from '../../../types/ms-python';
import DefaultInstaller from './default';
import { workspace } from 'vscode';
import { Uri } from 'vscode';
import { Terminal } from 'vscode';
import * as Terminals from './terminals';

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

  private pythonExtension: vscode.Extension<PythonExtension> | undefined;

  // Utility method to get the Python extension. If the extension was installed during this session,
  // `getExtension` won't resolve it, so we additionally check for its presence elsewhere.
  get pythonExtensionLoader(): vscode.Extension<PythonExtension> | undefined {
    return (this.pythonExtension =
      this.pythonExtension ||
      vscode.extensions.getExtension(PythonInstaller.PythonExtensionId) ||
      vscode.extensions.all.find(
        (extension) => extension.id === PythonInstaller.PythonExtensionId
      ));
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
  public static async withActiveEnvironment<T>(cb: () => Promise<T>): Promise<T> {
    const config = vscode.workspace.getConfiguration();
    const originalValue = config.get(this.PythonConfigActivate);
    if (originalValue === undefined || originalValue === true) return cb();

    const configTarget = PythonInstaller.getActiveConfigTarget(config, this.PythonConfigActivate);
    if (!configTarget) return cb();

    // Toggle the setting to true, run the callback, and then toggle it back.
    // It's important that we're modifying the same setting edited by the user,
    // otherwise by doing this we'd risk adding files to the project (e.g. .vscode/settings.json).
    await config.update(this.PythonConfigActivate, true, configTarget);
    try {
      // note await here is necessary so finally clause doesn't execute immediately
      return await cb();
    } finally {
      await config.update('python.terminal.activateEnvironment', originalValue, configTarget);
    }
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

      return;
    }

    // I'm not sure this is necessary, but it seems like a good idea to check
    // that the Python extension is active before we rely on it to configure
    // the user's terminal.
    if (!this.pythonExtensionLoader.isActive) {
      await this.pythonExtensionLoader.activate();
    }

    const pythonExtension = this.pythonExtensionLoader.exports;
    // The Python extension provides a secondary promise that resolves once all
    // parts of the extension are loaded.
    await pythonExtension.ready;

    const terminal = await this.obtainTerminal(pythonExtension, projectPath, env);

    terminal.show();
    terminal.sendText(cliCommand);
  }

  private usedPythonEnvironments = new Map<string, string>();
  private async obtainTerminal(
    ext: PythonExtension,
    projectPath: string,
    env?: { [key: string]: string | null | undefined },
    timeoutMs = 2000
  ): Promise<Terminal> {
    const targetEnv = getPythonEnvironment(ext, projectPath).path;
    const usedEnv = this.usedPythonEnvironments.get(projectPath);
    const existingTerm = Terminals.getMatching(projectPath, env);

    if (existingTerm && targetEnv === usedEnv) return existingTerm;

    this.usedPythonEnvironments.set(projectPath, targetEnv);

    return await PythonInstaller.withActiveEnvironment(async () => {
      const term = this.createTerminal(projectPath, env);
      const environment = await ext.environments.resolveEnvironment(targetEnv);

      // The `tools` array is expected to be empty if nothing has been determined to manage the environment.
      // In this case it's safe to return the terminal immediately - we're not expecting any activation commands.
      if (!environment || environment.tools.length === 0) return term;

      // Verify the terminal hasn't already received input before we wait for it.
      if (term.state.isInteractedWith) return term;

      // Wait for the terminal to be ready before sending the command.
      // To do this, we wait for a terminal interaction as we're expecting the
      // Python environment to be activated via some command. Otherwise, if we
      // timeout after `timeoutMs` milliseconds and continue on.
      return new Promise((resolve) => {
        const disposable = vscode.window.onDidChangeTerminalState((changedTerminal) => {
          if (changedTerminal !== term) return;
          if (changedTerminal.state.isInteractedWith) cleanupAndResolve();
        });
        const cleanupAndResolve = () => {
          disposable.dispose();
          clearTimeout(timeoutHandle);
          resolve(term);
        };
        const timeoutHandle = setTimeout(cleanupAndResolve, timeoutMs);
      });
    });
  }
}

function getPythonEnvironment({ environments }: PythonExtension, path: string): EnvironmentPath {
  const folder = workspace.getWorkspaceFolder(Uri.file(path));
  return environments.getActiveEnvironmentPath(folder);
}
