import * as vscode from 'vscode';
import chooseWorkspace from '../lib/chooseWorkspace';
import { ProgramName, getModulePath } from '../services/nodeDependencyProcess';
import ErrorCode from '../telemetry/definitions/errorCodes';
import { AppmapConfigManager, DEFAULT_APPMAP_DIR } from '../services/appmapConfigManager';
import { promisify } from 'util';
import { join } from 'path';
import { glob } from 'glob';
import { rm, stat } from 'fs/promises';
import runCommand from './runCommand';

export const ArchiveAppMaps = 'appmap.archive';

export default function archive(context: vscode.ExtensionContext) {
  const command = vscode.commands.registerCommand(
    ArchiveAppMaps,
    async (workspaceFolder?: vscode.WorkspaceFolder) => {
      if (!workspaceFolder) workspaceFolder = await chooseWorkspace();
      if (!workspaceFolder) return;

      const config = await AppmapConfigManager.getAppMapConfig(workspaceFolder);
      const cwd = config?.configFolder || workspaceFolder.uri.fsPath;

      const appmapDir = config?.appmapDir || DEFAULT_APPMAP_DIR;

      const appmapFiles = await promisify(glob)(join(cwd, appmapDir, '**/*.appmap.json'));
      if (appmapFiles.length === 0) {
        vscode.window.showInformationMessage(
          `No AppMaps found in ${config?.appmapDir}. Record some AppMaps and then try this command again.`
        );
        return;
      }

      vscode.window.withProgress(
        { location: vscode.ProgressLocation.Notification, title: 'Archiving AppMaps' },
        async () => {
          const mtime = new Date();

          // For now, make every archive a 'full' archive
          await rm(join(cwd, appmapDir, 'appmap_archive.json'), {
            force: true,
          });

          if (
            !(await runCommand(
              context,
              ErrorCode.ArchiveAppMapsFailure,
              `An error occurred while archiving AppMaps`,
              ['archive'],
              cwd
            ))
          )
            return;

          const archiveFiles = await promisify(glob)(join(cwd, '.appmap/archive/full/*.tar'));
          const mTimes = new Map<string, Date>();
          await Promise.all(
            archiveFiles.map(async (file) => mTimes.set(file, (await stat(file)).mtime))
          );

          const newArchiveFiles = [...archiveFiles]
            .filter((file) => mTimes.get(file)! > mtime)
            .map((file) => file.slice(cwd.length + 1));

          vscode.window.showInformationMessage(
            `Created AppMap archive ${newArchiveFiles.join(', ')}`
          );
        }
      );
    }
  );

  context.subscriptions.push(command);
}
