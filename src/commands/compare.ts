import * as vscode from 'vscode';
import ErrorCode from '../telemetry/definitions/errorCodes';
import { join, relative } from 'path';
import { rm, symlink, unlink } from 'fs/promises';
import { listRevisions } from './listRevisions';
import runCommand from './runCommand';
import { existsSync } from 'fs';
import chooseRevision from './chooseRevision';
import { ProjectStructure, WorkspaceAppMapCommand } from './WorkspaceAppMapCommand';
import { retry } from '../util';

export const CompareAppMapsCommandId = 'appmap.compare';

export default function compare(context: vscode.ExtensionContext) {
  WorkspaceAppMapCommand.register(context, Compare, CompareAppMapsCommandId);
}

export async function showReport(compareDir: string) {
  vscode.window.showInformationMessage(`Comparison is available at ${compareDir}/report.md`);

  await retry(
    async () => {
      if (!existsSync(join(compareDir, 'report.md')))
        throw new Error(`report.md file does not exist`);
    },
    3,
    250,
    false
  );

  await vscode.commands.executeCommand(
    'vscode.open',
    vscode.Uri.file(join(compareDir, 'report.md'))
  );
  await vscode.commands.executeCommand('markdown.showPreview');
}

class Compare extends WorkspaceAppMapCommand {
  protected async performRequest(project: ProjectStructure) {
    const revisions = await listRevisions(project.projectDir);
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
          await unlink(project.path(compareDir, 'head'));
        } catch (e) {
          console.debug(
            `Failed to unlink ${project.path(compareDir, 'head')}. This is probably benign.`
          );
        }
        await rm(project.path(compareDir), { recursive: true, force: true });

        for (const [revisionName, revision] of [
          ['base', baseRevision],
          ['head', headRevision],
        ]) {
          progress.report({ message: `Preparing '${revisionName}' AppMap data` });

          if (existsSync(join(compareDir, revisionName))) return;

          if (revision === firstRevision) {
            await symlink(
              relative(compareDir, project.appmapDir),
              project.path(compareDir, revisionName)
            );
          } else {
            await runCommand(
              this.context,
              ErrorCode.RestoreAppMapsFailure,
              `An error occurred while restoring ${revisionName} revision ${revision}`,
              ['restore', '--revision', revision, '--output-dir', join(compareDir, revisionName)],
              project.projectDir
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
            this.context,
            ErrorCode.CompareAppMapsFailure,
            'An error occurred while comparing AppMaps',
            compareArgs,
            project.projectDir
          ))
        )
          return;

        progress.report({ message: `Generating Markdown report` });
        if (
          !(await runCommand(
            this.context,
            ErrorCode.CompareReportAppMapsFailure,
            'An error occurred while generating comparison report',
            ['compare-report', compareDir],
            project.projectDir
          ))
        )
          return;

        await showReport(compareDir);
      }
    );
  }
}
