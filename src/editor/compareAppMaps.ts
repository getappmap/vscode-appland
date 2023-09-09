import * as vscode from 'vscode';
import { promptForAppMap } from '../lib/promptForAppMap';
import AppMapCollection from '../services/appmapCollection';
import {
  ProgramName,
  getModulePath,
  spawn,
  verifyCommandOutput,
} from '../services/nodeDependencyProcess';
import { DEBUG_EXCEPTION, Telemetry } from '../telemetry';
import ErrorCode from '../telemetry/definitions/errorCodes';
import { cp, mkdir, mkdtemp, readFile, readdir, rename, rm, writeFile } from 'fs/promises';
import { basename, join } from 'path';
import makeSequenceDiagram from '../lib/makeSequenceDiagram';
import { tmpdir } from 'os';

export default async function compareAppMaps(
  context: vscode.ExtensionContext,
  appmaps: AppMapCollection
): Promise<void> {
  const command = vscode.commands.registerCommand(
    'appmap.compareAppMaps',
    async (headAppMapUri: vscode.Uri, displayState?: string) => {
      const baseAppMapUri = await promptForAppMap(appmaps.appMaps(), [headAppMapUri]);
      if (!baseAppMapUri) return;

      let filter: string | undefined;
      if (displayState) {
        const displayStateObj = JSON.parse(Buffer.from(displayState, 'base64').toString('utf-8'));
        filter = displayStateObj.filters;
      }

      const baseDiagramFile = await makeSequenceDiagram(context, baseAppMapUri, filter);
      if (!baseDiagramFile) return;
      const headDiagramFile = await makeSequenceDiagram(context, headAppMapUri, filter);
      if (!headDiagramFile) return;

      const modulePath = await getModulePath({
        dependency: ProgramName.Appmap,
        globalStoragePath: context.globalStorageUri.fsPath,
      });

      let diffDiagramFile: string | undefined;
      {
        let workspaceFolder = vscode.workspace.getWorkspaceFolder(headAppMapUri);
        if (!workspaceFolder) {
          workspaceFolder = vscode.workspace.workspaceFolders?.[0];
        }
        if (!workspaceFolder) {
          vscode.window.showErrorMessage(
            'You must have a workspace folder open to make a sequence diagram or compare AppMaps'
          );
          return;
        }

        const tempDir = await mkdtemp(join(tmpdir(), 'appmap-vscode-'));
        const cmdArgs = {
          modulePath,
          args: [
            'sequence-diagram-diff',
            '--format',
            'json',
            '--output-dir',
            tempDir,
            baseDiagramFile.fsPath,
            headDiagramFile.fsPath,
          ],
          cwd: workspaceFolder.uri.fsPath,
          saveOutput: true,
        };
        const diagramCommand = spawn(cmdArgs);
        diagramCommand.addListener('data', process.stderr.write.bind(process.stderr));

        try {
          await verifyCommandOutput(diagramCommand);
        } catch (e) {
          Telemetry.sendEvent(DEBUG_EXCEPTION, {
            exception: e as Error,
            errorCode: ErrorCode.SequenceDiagramFailure,
            log: diagramCommand.log.toString(),
          });
          vscode.window.showWarningMessage(
            'Unable to generate a sequence diagram for the selected base AppMap.'
          );
          return;
        }

        {
          const tempDirContents = await readdir(tempDir);
          diffDiagramFile = tempDirContents.find((file) => file === 'diff.json');
        }
        if (!diffDiagramFile) {
          vscode.window.showWarningMessage(
            `Unable to find generated sequence diagram diff in temp dir ${tempDir}.`
          );
          return;
        }

        const appmapName = basename(headAppMapUri.fsPath, '.appmap.json');
        await mkdir(join(tempDir, 'head'));
        await mkdir(join(tempDir, 'diff'));
        await rename(
          join(tempDir, diffDiagramFile),
          join(tempDir, 'diff', [appmapName, 'diff.sequence.json'].join('.'))
        );
        await cp(headAppMapUri.fsPath, join(tempDir, 'head', basename(headAppMapUri.fsPath)));
        vscode.commands.executeCommand(
          'vscode.open',
          vscode.Uri.file(join(tempDir, 'diff', [appmapName, 'diff.sequence.json'].join('.')))
        );

        context.subscriptions.push({
          dispose: async () => {
            await rm(tempDir, { recursive: true, force: true });
          },
        });
      }
    }
  );

  context.subscriptions.push(command);
}
