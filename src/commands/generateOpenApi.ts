import assert from 'assert';
import * as vscode from 'vscode';
import ExtensionState from '../configuration/extensionState';
import chooseWorkspace from '../lib/chooseWorkspace';
import {
  getBinPath,
  OutputStream,
  ProgramName,
  spawn,
  verifyCommandOutput,
} from '../services/nodeDependencyProcess';
import { GENERATE_OPENAPI, Telemetry } from '../telemetry';

export const GenerateOpenApi = 'appmap.generateOpenApi';

export default async function generateOpenApi(
  context: vscode.ExtensionContext,
  extensionState: ExtensionState
): Promise<void> {
  const command = vscode.commands.registerCommand(
    GenerateOpenApi,
    async (
      viewColumn: vscode.ViewColumn = vscode.ViewColumn.Active,
      workspaceFolder?: vscode.WorkspaceFolder
    ) => {
      if (!workspaceFolder) workspaceFolder = await chooseWorkspace();
      if (!workspaceFolder) return;

      vscode.window.withProgress(
        { location: vscode.ProgressLocation.Notification, title: 'Generating OpenAPI definitions' },
        async () => {
          assert(workspaceFolder);

          const binPath = await getBinPath({
            dependency: ProgramName.Appmap,
            globalStoragePath: context.globalStorageUri.fsPath,
          });
          const openApiCmd = spawn({
            binPath,
            args: ['openapi', '--appmap-dir', workspaceFolder.uri.fsPath],
            saveOutput: true,
          });

          await verifyCommandOutput(openApiCmd);

          extensionState.setWorkspaceGeneratedOpenApi(workspaceFolder, true);
          Telemetry.sendEvent(GENERATE_OPENAPI, { rootDirectory: workspaceFolder.uri.fsPath });

          const document = await vscode.workspace.openTextDocument({
            language: 'yaml',
            content: openApiCmd.log
              .filter((line) => line.stream === OutputStream.Stdout)
              .map((line) => line.data)
              .join(''),
          });

          vscode.window.showTextDocument(document, viewColumn);
        }
      );
    }
  );

  context.subscriptions.push(command);
}
