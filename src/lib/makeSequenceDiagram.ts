import * as vscode from 'vscode';
import {
  ProgramName,
  getModulePath,
  spawn,
  verifyCommandOutput,
} from '../services/nodeDependencyProcess';
import { mkdtemp, readdir, rm } from 'fs/promises';
import { DEBUG_EXCEPTION, Telemetry } from '../telemetry';
import ErrorCode from '../telemetry/definitions/errorCodes';
import { tmpdir } from 'os';
import { join } from 'path';

export default async function makeSequenceDiagram(
  context: vscode.ExtensionContext,
  appMapUri: vscode.Uri,
  filter?: string
): Promise<vscode.Uri | undefined> {
  const modulePath = await getModulePath({
    dependency: ProgramName.Appmap,
    globalStoragePath: context.globalStorageUri.fsPath,
  });

  let workspaceFolder = vscode.workspace.getWorkspaceFolder(appMapUri);
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
  let diagramFile: string | undefined;
  {
    const cmdArgs = {
      modulePath,
      args: [
        'sequence-diagram',
        '--format',
        `json`,
        '--filter',
        Buffer.from(JSON.stringify(filter)).toString('base64'),
        '--output-dir',
        tempDir,
        appMapUri.fsPath,
      ],
      cwd: workspaceFolder.uri.fsPath,
      saveOutput: true,
    };
    const diagramCommand = spawn(cmdArgs);
    try {
      await verifyCommandOutput(diagramCommand);
    } catch (e) {
      Telemetry.sendEvent(DEBUG_EXCEPTION, {
        exception: e as Error,
        errorCode: ErrorCode.SequenceDiagramFailure,
        log: diagramCommand.log.toString(),
      });
      vscode.window.showWarningMessage(
        'Unable to generate a sequence diagram for the selected AppMap.'
      );
      return;
    }

    {
      const tempDirContents = await readdir(tempDir);
      diagramFile = tempDirContents.find((file) => file.endsWith('.sequence.json'));
    }
    if (!diagramFile) {
      vscode.window.showWarningMessage(
        `Unable to find generated sequence diagram in temp dir ${tempDir}.`
      );
      return;
    }

    context.subscriptions.push({
      dispose: async () => {
        await rm(tempDir, { recursive: true, force: true });
      },
    });

    return vscode.Uri.file(`${tempDir}/${diagramFile}`);
  }
}
