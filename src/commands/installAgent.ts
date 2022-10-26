import * as vscode from 'vscode';
import os from 'os';
import { join } from 'path';
import { CLICK_INSTALL_BUTTON, INSTALL_BUTTON_ERROR, Telemetry } from '../telemetry';
import { NodeProcessService } from '../services/nodeProcessService';

export const InstallAgent = 'appmap.installAgent';
const ELECTRON_COMMAND_PLATFORMS = ['linux', 'darwin'];

// these are in order of precedence
const CONFIG_LOCATIONS = [
  'workspaceFolderLanguageValue',
  'workspaceLanguageValue',
  'globalLanguageValue',
  'defaultLanguageValue',
  'workspaceFolderValue',
  'workspaceValue',
  'globalValue',
  'defaultValue',
];

let pendingTask: Thenable<unknown> | undefined;

type InstallEnv = {
  ELECTRON_RUN_AS_NODE?: string;
};

type InstallInformation = {
  command: string;
  env: InstallEnv;
};

function getConfigTargetFromConfigLocation(
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

function getActiveConfigLocation(config: vscode.WorkspaceConfiguration, scope: string): string {
  const configInfo = config.inspect(scope) || {};
  const activeConfig = CONFIG_LOCATIONS.find((configLocation) => {
    const terminalSettings = configInfo[configLocation]?.terminal;
    return terminalSettings && Object.keys(terminalSettings).includes('activateEnvironment');
  });

  return activeConfig || '';
}

function createTerminal(command: string, path: string, env: InstallEnv): void {
  const terminal = vscode.window.createTerminal({
    name: 'install-appmap',
    cwd: path,
    env,
  });
  terminal.show();
  terminal.sendText(command);
}

function escapePath(str: string): string {
  // on windows, quote everything except the drive letter (e.g. C:"\Users\user\projects\directory with spaces")
  // this ensures that all terminals will correctly read the path and will not lose path separators
  if (os.platform() === 'win32') {
    const [driverLetter, restOfPath] = str.split(':');
    return `${driverLetter}:"${restOfPath}"`;
  }

  return str.replace(/([^A-Za-z0-9_\-.,:/@\n])/g, '\\$1');
}

function electronCommand(globalStorageDir: string, installLocation: string): string {
  const nodePath = escapePath(process.argv0);
  const cliPath = join(globalStorageDir, 'node_modules', '@appland', 'appmap', 'built', 'cli.js');
  const flags = ['--ms-enable-electron-run-as-node', '-d', installLocation];
  return `ELECTRON_RUN_AS_NODE=true ${nodePath} ${cliPath} install ${flags.join(' ')}`;
}

export function generateInstallInfo(
  path: string,
  language: string,
  hasCLIBin: boolean,
  globalStorageDir: string
): InstallInformation {
  const escapedStorageDir = escapePath(globalStorageDir);
  const installLocation = escapePath(path);
  const env = {};
  let command = `npx @appland/appmap install -d ${installLocation}`;

  const isElectronApp = !vscode.env.remoteName;
  const canSendElectronComamnd = ELECTRON_COMMAND_PLATFORMS.includes(os.platform());

  if (language !== 'JavaScript') {
    if (isElectronApp && canSendElectronComamnd) {
      env['ELECTRON_RUN_AS_NODE'] = 'true';
      command = electronCommand(escapedStorageDir, installLocation);
    } else if (os.platform() === 'win32' && hasCLIBin) {
      const binPath = escapePath(join(globalStorageDir, 'appmap-win-x64.exe'));
      command = `${binPath} install -d ${installLocation}`;
    }
  }

  return {
    command,
    env,
  };
}

export default async function installAgent(
  context: vscode.ExtensionContext,
  hasCLIBin: boolean
): Promise<void> {
  vscode.commands.registerCommand(InstallAgent, async (path: string, language: string) => {
    try {
      const { processService } = context.extension.exports as {
        processService?: NodeProcessService;
      };
      if (!processService) {
        vscode.window.showErrorMessage('The AppMap extension is pending initialization');
        return;
      }

      if (!processService.ready) {
        // Check to see if we're already waiting
        if (pendingTask) return;

        pendingTask = vscode.window.withProgress(
          {
            cancellable: false,
            location: vscode.ProgressLocation.Notification,
            title: `The AppMap CLI is updating...`,
          },
          async () => {
            return new Promise<void>((resolve) => {
              const disposable = processService.onReady(() => {
                resolve();
                disposable.dispose();
              });
            });
          }
        );
        await pendingTask;
        pendingTask = undefined;
      }

      const { command, env } = generateInstallInfo(
        path,
        language,
        hasCLIBin,
        context.globalStorageUri.fsPath
      );

      // check if we need to temporarily suppress terminal activation in python
      if (language === 'Python') {
        const config = vscode.workspace.getConfiguration();
        const originalValue = config.get('python.terminal.activateEnvironment');

        if (originalValue) {
          const activePythonConfig = getActiveConfigLocation(config, 'python');
          const configTarget = getConfigTargetFromConfigLocation(activePythonConfig);
          await config.update('python.terminal.activateEnvironment', false, configTarget);
          createTerminal(command, path, env);

          // restore settings to original state
          await config.update('python.terminal.activateEnvironment', originalValue, configTarget);
          Telemetry.sendEvent(CLICK_INSTALL_BUTTON, { rootDirectory: path });
          return;
        }
      }

      createTerminal(command, path, env);
      Telemetry.sendEvent(CLICK_INSTALL_BUTTON, { rootDirectory: path });
    } catch (err) {
      const exception = err as Error;
      Telemetry.sendEvent(INSTALL_BUTTON_ERROR, { rootDirectory: path, exception });
    }
  });
}
