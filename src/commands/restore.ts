import * as vscode from 'vscode';
import ErrorCode from '../telemetry/definitions/errorCodes';
import { rm, symlink, unlink } from 'fs/promises';
import { listRevisions } from './listRevisions';
import chooseRevision from './chooseRevision';
import { ProjectStructure, WorkspaceAppMapCommand } from './WorkspaceAppMapCommand';

export const RestoreAppMapsCommandId = 'appmap.restore';

export default function restore(context: vscode.ExtensionContext) {
  WorkspaceAppMapCommand.register(context, Restore, RestoreAppMapsCommandId);
}

class Restore extends WorkspaceAppMapCommand {
  protected async performRequest(project: ProjectStructure) {
    const revisions = await listRevisions(project.projectDir);
    if (!revisions) return;

    const revision = await chooseRevision(revisions, `Choose a revision to restore`);
    if (!revision) return;

    vscode.window.withProgress(
      { location: vscode.ProgressLocation.Notification, title: 'Restoring AppMap Archive' },
      async () => {
        await rm(project.path('.appmap', 'work', revision), { recursive: true, force: true });

        if (
          !(await this.runCommand(
            project,
            ErrorCode.RestoreAppMapsFailure,
            'An error occurred while restoring AppMaps',
            ['restore', '--revision', revision, '--exact']
          ))
        )
          return;

        try {
          await unlink(project.path('.appmap', 'base'));
        } catch {
          console.debug(`Unlinking .appmap/base failed, this is probably benign`);
        }
        await symlink(project.path('.appmap', 'work', revision), project.path('.appmap', 'base'));

        vscode.window.showInformationMessage(`Restored AppMap archive ${revision} to .appmap/base`);
      }
    );
  }
}
