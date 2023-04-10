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
import { AppMapConfig, AppmapConfigManager } from '../services/appmapConfigManager';

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

          const modulePath = await getModulePath({
            dependency: ProgramName.Appmap,
            globalStoragePath: context.globalStorageUri.fsPath,
          });

          let appmapDir = AppmapConfigManager.DEFAULT_APPMAP_DIR;
          let cwd = workspaceFolder.uri.fsPath;

          const { configs } = await AppmapConfigManager.getWorkspaceConfig(workspaceFolder);
          let configToUse: AppMapConfig | undefined;

          if (configs.length === 1) {
            configToUse = configs[0];
          } else {
            const pick = await vscode.window.showQuickPick(
              configs.map((config) => config.configFolder),
              { canPickMany: false, placeholder: 'Choose a folder: ' } as vscode.QuickPickOptions
            );

            configToUse = configs.find((config) => config.configFolder === pick);
          }

          if (configToUse && configToUse.appmapDir && configToUse.configFolder) {
            appmapDir = configToUse.appmapDir;
            cwd = configToUse.configFolder;
          }

          const openApiCmd = spawn({
            modulePath,
            args: ['openapi', '--appmap-dir', appmapDir],
            cwd,
            saveOutput: true,
          });

          try {
            await verifyCommandOutput(openApiCmd);
          } catch (e) {
            Telemetry.sendEvent(DEBUG_EXCEPTION, {
              exception: e as Error,
              errorCode: ErrorCode.GenerateOpenApiFailure,
              log: openApiCmd.log.toString(),
            });
            vscode.window.showWarningMessage(
              'Failed to generate OpenAPI definitions. Please try again later.'
            );
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
