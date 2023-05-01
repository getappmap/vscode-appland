import * as vscode from 'vscode';
import chooseWorkspace from '../lib/chooseWorkspace';
import ErrorCode from '../telemetry/definitions/errorCodes';
import { AppmapConfigManager, DEFAULT_APPMAP_DIR } from '../services/appmapConfigManager';
import { promisify } from 'util';
import { join } from 'path';
import { glob } from 'glob';
import { rm, symlink, unlink } from 'fs/promises';
import { listRevisions } from './validation';
import runCommand from './runCommand';

export const ArchiveAppMaps = 'appmap.restore';

export default function restore(context: vscode.ExtensionContext) {
  const command = vscode.commands.registerCommand(
    ArchiveAppMaps,
    async (workspaceFolder?: vscode.WorkspaceFolder) => {
      if (!workspaceFolder) workspaceFolder = await chooseWorkspace();
      if (!workspaceFolder) return;

      const config = await AppmapConfigManager.getAppMapConfig(workspaceFolder);
      const cwd = config?.configFolder || workspaceFolder.uri.fsPath;

      const revisions = await listRevisions(cwd);
      if (!revisions) return;

      const options: vscode.QuickPickOptions = {
        canPickMany: false,
        placeHolder: 'Choose a revision to restore',
      };
      const revision = await vscode.window.showQuickPick(revisions, options);
      if (!revision) return;

      vscode.window.withProgress(
        { location: vscode.ProgressLocation.Notification, title: 'Restoring AppMap Archive' },
        async () => {
          await rm(join(cwd, '.appmap', 'work', revision), { recursive: true, force: true });

          if (
            !(await runCommand(
              context,
              ErrorCode.RestoreAppMapsFailure,
              'An error occurred while restoring AppMaps',
              ['restore', '--revision', revision, '--exact'],
              cwd
            ))
          )
            return;

          try {
            await unlink(join(cwd, '.appmap', 'current'));
          } catch {
            console.debug(`Unlinking .appmap/current failed, this is probably benign`);
          }
          await symlink(join(cwd, '.appmap', 'work', revision), join(cwd, '.appmap', 'current'));

          vscode.window.showInformationMessage(
            `Restored AppMap archive ${revision} to .appmap/current`
          );
        }
      );
    }
  );

  context.subscriptions.push(command);
}
