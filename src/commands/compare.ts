import * as vscode from 'vscode';
import chooseWorkspace from '../lib/chooseWorkspace';
import ErrorCode from '../telemetry/definitions/errorCodes';
import { AppmapConfigManager, DEFAULT_APPMAP_DIR } from '../services/appmapConfigManager';
import { join, relative } from 'path';
import { rm, symlink, unlink } from 'fs/promises';
import { listRevisions } from './listRevisions';
import runCommand from './runCommand';
import { existsSync } from 'fs';
import chooseRevision from './chooseRevision';

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
      if (!revisions || revisions.length === 0) return;

      const baseRevision = await chooseRevision(revisions, `Choose the base revision`);
      if (!baseRevision) return;

      const firstRevision = revisions[0].revision;
      const headRevision = await chooseRevision(revisions, 'Choose the head revision', [
        baseRevision,
      ]);
      if (!headRevision) return;

      let headRevisionFolder: string;

      if (headRevision === firstRevision) {
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

            if (revision === firstRevision) {
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

          await new Promise((resolve) => setTimeout(resolve, 250));

          await vscode.commands.executeCommand(
            'vscode.open',
            vscode.Uri.file(join(compareDir, 'report.md'))
          );
          await vscode.commands.executeCommand('markdown.showPreview');
        }
      );
    }
  );

  context.subscriptions.push(command);
}
