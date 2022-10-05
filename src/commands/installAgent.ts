import * as vscode from 'vscode';
import os from 'os';
import { join } from 'path';
import { CLICK_INSTALL_BUTTON, INSTALL_BUTTON_ERROR, Telemetry } from '../telemetry';
import { NodeProcessService } from '../services/nodeProcessService';

export const InstallAgent = 'appmap.installAgent';
const ELECTRON_COMMAND_PLATFORMS = ['linux', 'darwin'];
let pendingTask: Thenable<unknown> | undefined;

const escape = (str) => str.replace(/([^A-Za-z0-9_\-.,:/@\n])/g, '\\$1');

function formatProjectPath(path: string): string {
  if (path.includes(' ')) {
    return "'" + path + "'";
  }
  return path;
}

function electronCommand(globalStorageDir: string, installLocation: string): string {
  const nodePath = escape(process.argv0);
  const cliPath = `${escape(globalStorageDir)}/node_modules/@appland/appmap/built/cli.js`;
  const flags = ['--ms-enable-electron-run-as-node', '-d', escape(installLocation)];
  return `ELECTRON_RUN_AS_NODE=true ${nodePath} ${cliPath} install ${flags.join(' ')}`;
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

      const installLocation = formatProjectPath(path);
      const env = {};
      let command = `npx @appland/appmap install -d ${installLocation}`;

      const isElectronApp = !vscode.env.remoteName;
      const canSendElectronComamnd = ELECTRON_COMMAND_PLATFORMS.includes(os.platform());

      if (language !== 'JavaScript') {
        if (isElectronApp && canSendElectronComamnd) {
          env['ELECTRON_RUN_AS_NODE'] = 'true';
          command = electronCommand(context.globalStorageUri.fsPath, installLocation);
        } else if (os.platform() === 'win32' && hasCLIBin) {
          const binPath = join(escape(context.globalStorageUri.fsPath), 'appmap-win-x64.exe');
          command = `${binPath} install -d ${installLocation}`;
        }
      }

      const terminal = vscode.window.createTerminal({
        name: 'install-appmap',
        cwd: path,
        env,
      });
      terminal.show();
      terminal.sendText(command);

      Telemetry.sendEvent(CLICK_INSTALL_BUTTON, { rootDirectory: path });
    } catch (err) {
      const exception = err as Error;
      Telemetry.sendEvent(INSTALL_BUTTON_ERROR, { rootDirectory: path, exception });
    }
  });
}
