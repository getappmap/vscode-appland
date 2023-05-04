import * as vscode from 'vscode';
import ErrorCode from '../telemetry/definitions/errorCodes';
import { basename, dirname } from 'path';
import { stat } from 'fs/promises';
import { promisify } from 'util';
import { glob } from 'glob';
import assert from 'assert';
import { ProjectStructure, WorkspaceAppMapCommand } from './WorkspaceAppMapCommand';
import { showReport } from './compare';

export const ReCompareAppMapsCommandId = 'appmap.reCompare';

export default function reCompare(context: vscode.ExtensionContext) {
  WorkspaceAppMapCommand.register(context, ReCompare, ReCompareAppMapsCommandId);
}

class ReCompare extends WorkspaceAppMapCommand {
  protected async performRequest(project: ProjectStructure) {
    const compareFiles = await promisify(glob)(
      project.path('.appmap/change-report/*/change-report.json')
    );
    if (compareFiles.length === 0) {
      vscode.window.showInformationMessage(
        `No change reports found. Run 'AppMap: Compare AppMap Archives', then you can run this ` +
          `command to repeat that comparison using your updated AppMaps.`
      );
      return;
    }

    const mTimes = new Map<string, Date>();
    await Promise.all(compareFiles.map(async (file) => mTimes.set(file, (await stat(file)).mtime)));
    compareFiles.sort((a, b) => mTimes.get(b)!.getTime() - mTimes.get(a)!.getTime());
    const lastCompare = compareFiles.shift();
    assert(lastCompare);
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
          !(await this.runCommand(
            project,
            ErrorCode.CompareAppMapsFailure,
            'An error occurred while comparing AppMaps',
            compareArgs
          ))
        )
          return;

        progress.report({ message: `Generating Markdown report` });
        if (
          !(await this.runCommand(
            project,
            ErrorCode.CompareReportAppMapsFailure,
            'An error occurred while generating comparison report',
            ['compare-report', compareDir]
          ))
        )
          return;

        await showReport(compareDir);
      }
    );
  }
}
