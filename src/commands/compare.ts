import * as vscode from 'vscode';
import chooseWorkspace from '../lib/chooseWorkspace';
import ErrorCode from '../telemetry/definitions/errorCodes';
import { AppmapConfigManager, DEFAULT_APPMAP_DIR } from '../services/appmapConfigManager';
import { join, relative } from 'path';
import { rm, symlink, unlink } from 'fs/promises';
import { listRevisions } from './validation';
import assert from 'assert';
import runCommand from './runCommand';
import { existsSync } from 'fs';

export const ArchiveAppMaps = 'appmap.compare';

export default function compare(context: vscode.ExtensionContext) {
  const command = vscode.commands.registerCommand(
    ArchiveAppMaps,
    async (workspaceFolder?: vscode.WorkspaceFolder) => {
      if (!workspaceFolder) workspaceFolder = await chooseWorkspace();
      if (!workspaceFolder) return;

      const config = await AppmapConfigManager.getAppMapConfig(workspaceFolder);
      const cwd = config?.configFolder || workspaceFolder.uri.fsPath;
      const appmapDir = config?.appmapDir || DEFAULT_APPMAP_DIR;

      const revisions = await listRevisions(cwd);
      if (!revisions) return;

      async function chooseRevision(
        revisionName: string,
        exclude: string[] = [],
        extraRevisions: string[] = []
      ): Promise<string | undefined> {
        assert(revisions);
        const options: vscode.QuickPickOptions = {
          canPickMany: false,
          placeHolder: `Choose the ${revisionName} revision`,
        };
        const avaliableRevisions = revisions?.filter((rev) => !exclude.includes(rev));
        return await vscode.window.showQuickPick(
          [...extraRevisions, ...avaliableRevisions],
          options
        );
      }

      const baseRevision = await chooseRevision('base');
      if (!baseRevision) return;

      const currentAppMapsName = `AppMaps in ${appmapDir}`;
      const headRevision = await chooseRevision('head', [baseRevision], [currentAppMapsName]);
      if (!headRevision) return;

      let headRevisionFolder: string;

      if (headRevision === currentAppMapsName) {
        headRevisionFolder = 'head';
      } else {
        headRevisionFolder = headRevision;
      }

      const compareDir = join(
        '.appmap',
        'change-report',
        [baseRevision, headRevisionFolder].join('-')
      );

      vscode.window.withProgress(
        { location: vscode.ProgressLocation.Notification, title: 'Comparing AppMap revisions' },
        async (progress: vscode.Progress<{ message?: string; increment?: number }>) => {
          progress.report({ message: 'Removing existing comparison dir (if any)' });

          try {
            await unlink(join(cwd, compareDir, 'head'));
          } catch (e) {
            console.debug(
              `Failed to unlink ${join(cwd, compareDir, 'head')}. This is probably benign.`
            );
          }
          await rm(join(cwd, compareDir), { recursive: true, force: true });

          for (const [revisionName, revision] of [
            ['base', baseRevision],
            ['head', headRevision],
          ]) {
            progress.report({ message: `Preparing '${revisionName}' AppMap data` });

            if (existsSync(join(compareDir, revisionName))) return;

            if (revision === currentAppMapsName) {
              await symlink(relative(compareDir, appmapDir), join(cwd, compareDir, revisionName));
            } else {
              await runCommand(
                context,
                ErrorCode.RestoreAppMapsFailure,
                `An error occurred while restoring ${revisionName} revision ${revision}`,
                [
                  'restore',
                  '-d',
                  cwd,
                  '--revision',
                  revision,
                  '--output-dir',
                  join(compareDir, revisionName),
                ],
                cwd
              );
            }
          }

          progress.report({ message: `Comparing 'base' and 'head' revisions` });
          const compareArgs = [
            'compare',
            '--no-delete-unchanged',
            '-b',
            baseRevision,
            '-h',
            headRevisionFolder,
          ];
          if (
            !(await runCommand(
              context,
              ErrorCode.CompareAppMapsFailure,
              'An error occurred while comparing AppMaps',
              compareArgs,
              cwd
            ))
          )
            return;

          progress.report({ message: `Generating Markdown report` });
          if (
            !(await runCommand(
              context,
              ErrorCode.CompareReportAppMapsFailure,
              'An error occurred while generating comparison report',
              ['compare-report', compareDir],
              cwd
            ))
          )
            return;

          vscode.window.showInformationMessage(
            `Comparison is available at ${compareDir}/report.md`
          );

          vscode.commands.executeCommand('vscode.open', `${compareDir}/report.md`);
        }
      );
    }
  );

  context.subscriptions.push(command);
}
