import assert from 'assert';
import * as vscode from 'vscode';

import chooseWorkspace from '../lib/chooseWorkspace';
import {
  getModulePath,
  OutputStream,
  ProgramName,
  spawn,
  verifyCommandOutput,
} from '../services/nodeDependencyProcess';
import { DEBUG_EXCEPTION, Telemetry } from '../telemetry';
import ErrorCode from '../telemetry/definitions/errorCodes';
import { AppmapConfigManager } from '../services/appmapConfigManager';
import { workspaceServices } from '../services/workspaceServices';
import AssetService from '../assets/assetService';
import { AssetIdentifier } from '../assets';

export const GenerateOpenApi = 'appmap.generateOpenApi';

export default function generateOpenApi(context: vscode.ExtensionContext) {
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

          const modulePath = getModulePath(ProgramName.Appmap);

          let appmapDir = '.';
          let cwd = workspaceFolder.uri.fsPath;

          const appmapConfigManagerInstance = workspaceServices().getServiceInstanceFromClass(
            AppmapConfigManager,
            workspaceFolder
          );
          assert(appmapConfigManagerInstance);

          const appmapConfig = await appmapConfigManagerInstance.getAppmapConfig();

          if (appmapConfig) {
            appmapDir = appmapConfig.appmapDir;
            cwd = appmapConfig.configFolder;
          }

          const openApiCmd = spawn({
            modulePath,
            binPath: AssetService.getAssetPath(AssetIdentifier.AppMapCli),
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
