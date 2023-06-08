import * as vscode from 'vscode';
import os from 'os';
import { join } from 'path';
import { CLICK_INSTALL_BUTTON, INSTALL_BUTTON_ERROR, Telemetry } from '../telemetry';
import { NodeProcessService } from '../services/nodeProcessService';
import { Installer } from './installer';
import DefaultInstaller from './installer/default';
import PythonInstaller from './installer/python';

export const InstallAgent = 'appmap.installAgent';
const ELECTRON_COMMAND_PLATFORMS = ['linux', 'darwin'];

let pendingTask: Thenable<unknown> | undefined;

type InstallEnv = {
  ELECTRON_RUN_AS_NODE?: string;
};

type InstallInformation = {
  command: string;
  env: InstallEnv;
};

type TerminalsByOS = {
  windows: string | null;
  osx: string | null;
  linux: string | null;
};

export type TerminalConfig = {
  defaultProfile: TerminalsByOS | undefined;
  shell: TerminalsByOS | undefined;
};

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
  // `child_process.fork` uses `process.execPath` from the parent process to spawn a new process.
  // This is the exact behavior we want to emulate in the terminal, so we'll use it here as well.
  const nodePath = escapePath(process.execPath);
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
  let command = `npx @appland/appmap@latest install -d ${installLocation}`;

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

function getDefaultTerminals(): TerminalConfig {
  const terminalConfig = vscode.workspace.getConfiguration('terminal.integrated');
  const defaultProfile = terminalConfig?.defaultProfile;
  const shell = terminalConfig?.shell;
  return {
    defaultProfile,
    shell,
  };
}

// Installers are run in order of precedence
// The default installer should always be last
const installers: Array<Installer> = [new PythonInstaller(), new DefaultInstaller()];

async function getAvailableInstaller(
  projectPath: string,
  language: string
): Promise<Installer | undefined> {
  for (const installer of installers) {
    if (await installer.canInstall(language, projectPath)) return installer;
  }
}

export default async function installAgent(
  context: vscode.ExtensionContext,
  hasCLIBin: boolean
): Promise<void> {
  vscode.commands.registerCommand(InstallAgent, async (path: string, language: string) => {
    const defaultTerminals = getDefaultTerminals();

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

      const installer = await getAvailableInstaller(path, language);
      if (!installer) {
        // As long as the default installer is available this shouldn't ever happen
        vscode.window.showErrorMessage(
          'The AppMap extension is unable to install the AppMap agent for this project'
        );
        return;
      }

      Telemetry.sendEvent(CLICK_INSTALL_BUTTON, { rootDirectory: path, defaultTerminals });

      await installer.execute(command, path, env);
    } catch (err) {
      const exception = err as Error;
      Telemetry.sendEvent(INSTALL_BUTTON_ERROR, {
        rootDirectory: path,
        exception,
        defaultTerminals,
      });
    }
  });
}
