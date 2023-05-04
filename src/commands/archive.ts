import * as vscode from 'vscode';
import ErrorCode from '../telemetry/definitions/errorCodes';
import { promisify } from 'util';
import { join } from 'path';
import { glob } from 'glob';
import { rm, stat } from 'fs/promises';
import { ProjectStructure, WorkspaceAppMapCommand } from './WorkspaceAppMapCommand';

export const ArchiveAppMapsCommandId = 'appmap.archive';

export default function archive(context: vscode.ExtensionContext) {
  WorkspaceAppMapCommand.register(context, Archive, ArchiveAppMapsCommandId);
}

class Archive extends WorkspaceAppMapCommand {
  protected async performRequest(project: ProjectStructure) {
    const appmapFiles = await promisify(glob)(project.path(project.appmapDir, '**/*.appmap.json'));
    if (appmapFiles.length === 0) {
      vscode.window.showInformationMessage(
        `No AppMaps found in ${project.appmapDir}. Record some AppMaps and then try this command again.`
      );
      return;
    }

    vscode.window.withProgress(
      { location: vscode.ProgressLocation.Notification, title: 'Archiving AppMaps' },
      async () => {
        const mtime = new Date();

        // For now, make every archive a 'full' archive
        await rm(project.path(project.appmapDir, 'appmap_archive.json'), {
          force: true,
        });

        if (
          !(await this.runCommand(
            project,
            ErrorCode.ArchiveAppMapsFailure,
            `An error occurred while archiving AppMaps`,
            ['archive']
          ))
        )
          return;

        const archiveFiles = await promisify(glob)(project.path('.appmap/archive/full/*.tar'));
        const mTimes = new Map<string, Date>();
        await Promise.all(
          archiveFiles.map(async (file) => mTimes.set(file, (await stat(file)).mtime))
        );

        const newArchiveFiles = [...archiveFiles]
          .filter((file) => mTimes.get(file)! > mtime)
          .map((file) => file.slice(project.projectDir.length + 1));

        vscode.window.showInformationMessage(
          `Created AppMap archive ${newArchiveFiles.join(', ')}`
        );
      }
    );
  }
}
