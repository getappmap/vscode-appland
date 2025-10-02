import * as vscode from 'vscode';
import os from 'os';
import { INSTALL_BUTTON_ERROR, Telemetry } from '../telemetry';
import { NodeProcessService } from '../services/nodeProcessService';
import { Installer } from './installer';
import DefaultInstaller from './installer/default';
import PythonInstaller from './installer/python';
import CommandRegistry from './commandRegistry';
import AssetService from '../assets/assetService';
import { AssetIdentifier } from '../assets';

export const InstallAgent = 'appmap.installAgent';

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

export function getInstallCommand(path: string): string {
  return `${AssetService.getAssetPath(AssetIdentifier.AppMapCli)} install -d ${escapePath(path)}`;
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

export default function installAgent(context: vscode.ExtensionContext): void {
  CommandRegistry.registerCommand(InstallAgent, async (path: string, language: string) => {
    const defaultTerminals = getDefaultTerminals();

    try {
      const { processService } = context.extension.exports as {
        processService?: NodeProcessService;
      };
      if (!processService) {
        vscode.window.showErrorMessage('The AppMap extension is pending initialization');
        return;
      }

      const command = getInstallCommand(path);
      const installer = await getAvailableInstaller(path, language);
      if (!installer) {
        // As long as the default installer is available this shouldn't ever happen
        vscode.window.showErrorMessage(
          'The AppMap extension is unable to install the AppMap agent for this project'
        );
        return;
      }

      await installer.execute(command, path);
    } catch (err) {
      const exception = err as Error;
      Telemetry.sendEvent(INSTALL_BUTTON_ERROR, {
        exception,
        defaultTerminals,
      });
    }
  });
}
