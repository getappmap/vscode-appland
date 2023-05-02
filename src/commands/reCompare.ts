import * as vscode from 'vscode';
import chooseWorkspace from '../lib/chooseWorkspace';
import ErrorCode from '../telemetry/definitions/errorCodes';
import { AppmapConfigManager } from '../services/appmapConfigManager';
import { basename, dirname, join, relative } from 'path';
import { stat } from 'fs/promises';
import runCommand from './runCommand';
import { promisify } from 'util';
import { glob } from 'glob';

export const ArchiveAppMaps = 'appmap.reCompare';

export default function reCompare(context: vscode.ExtensionContext) {
  const command = vscode.commands.registerCommand(
    ArchiveAppMaps,
    async (workspaceFolder?: vscode.WorkspaceFolder) => {
      if (!workspaceFolder) workspaceFolder = await chooseWorkspace();
      if (!workspaceFolder) return;

      const config = await AppmapConfigManager.getAppMapConfig(workspaceFolder);
      const cwd = config?.configFolder || workspaceFolder.uri.fsPath;

      const compareFiles = await promisify(glob)(
        join(cwd, '.appmap/change-report/*/change-report.json')
      );
      const mTimes = new Map<string, Date>();
      await Promise.all(
        compareFiles.map(async (file) => mTimes.set(file, (await stat(file)).mtime))
      );
      compareFiles.sort((a, b) => mTimes.get(b)!.getTime() - mTimes.get(a)!.getTime());
      const lastCompare = compareFiles.shift();
      const compareDir = dirname(lastCompare);
      const compareDirName = basename(compareDir);
      const [baseRevision, headRevision] = compareDirName.split('-');

      vscode.window.withProgress(
        { location: vscode.ProgressLocation.Notification, title: 'Comparing AppMap revisions' },
        async (progress: vscode.Progress<{ message?: string; increment?: number }>) => {
          progress.report({ message: `Comparing 'base' and 'head' revisions` });
          const compareArgs = [
            'compare',
            '--no-delete-unchanged',
            '-b',
            baseRevision,
            '-h',
            headRevision,
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
