import assert from 'assert';
import * as vscode from 'vscode';

import ExtensionState from '../configuration/extensionState';
import chooseWorkspace from '../lib/chooseWorkspace';
import {
  getModulePath,
  OutputStream,
  ProgramName,
  spawn,
  verifyCommandOutput,
} from '../services/nodeDependencyProcess';
import { DEBUG_EXCEPTION, GENERATE_OPENAPI, Telemetry } from '../telemetry';
import ErrorCode from '../telemetry/definitions/errorCodes';
import { AppmapConfigManager, DEFAULT_APPMAP_DIR } from '../services/appmapConfigManager';

export const GenerateOpenApi = 'appmap.generateOpenApi';

export default function generateOpenApi(
  context: vscode.ExtensionContext,
  extensionState: ExtensionState
) {
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

          const modulePath = await getModulePath({
            dependency: ProgramName.Appmap,
            globalStoragePath: context.globalStorageUri.fsPath,
          });

          const config = await AppmapConfigManager.getAppMapConfig(workspaceFolder);

          const openApiCmd = spawn({
            modulePath,
            args: ['openapi', '--appmap-dir', config?.appmapDir || DEFAULT_APPMAP_DIR],
            cwd: config?.configFolder || workspaceFolder.uri.fsPath,
            saveOutput: true,
          });

          try {
            await verifyCommandOutput(openApiCmd);
          } catch (e) {
            console.error(e);
            Telemetry.sendEvent(DEBUG_EXCEPTION, {
              exception: e as Error,
              errorCode: ErrorCode.GenerateOpenApiFailure,
              log: openApiCmd.log.toString(),
            });
            vscode.window.showWarningMessage(`An error occurred generating OpenAPI`);
            return;
          }

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
