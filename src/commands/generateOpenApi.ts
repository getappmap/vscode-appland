import * as vscode from 'vscode';
import ExtensionState from '../configuration/extensionState';
import { getBinPath, OutputStream, ProgramName, spawn } from '../services/nodeDependencyProcess';
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
      if (!workspaceFolder) {
        if (!vscode.workspace.workspaceFolders || vscode.workspace.workspaceFolders.length === 0) {
          vscode.window.showErrorMessage('No workspace is available.');
          return;
        }

        if (vscode.workspace.workspaceFolders.length === 1) {
          workspaceFolder = vscode.workspace.workspaceFolders[0];
        } else {
          // Let the user pick a workspace folder
          const workspaceName = await vscode.window.showQuickPick(
            vscode.workspace.workspaceFolders.map((folder) => folder.name),
            { placeHolder: 'Select a directory' }
          );

          if (!workspaceName) {
            return;
          }

          workspaceFolder = vscode.workspace.workspaceFolders.find(
            (folder) => folder.name === workspaceName
          );
        }
      }

      vscode.window.withProgress(
        { location: vscode.ProgressLocation.Notification, title: 'Generating OpenAPI definitions' },
        async () => {
          if (!workspaceFolder) {
            return;
          }

          const binPath = await getBinPath({
            dependency: ProgramName.Appmap,
            globalStoragePath: context.globalStorageUri.fsPath,
          });
          const openApiCmd = spawn({
            binPath,
            args: ['openapi', '--appmap-dir', workspaceFolder.uri.fsPath],
            cacheLog: true,
          });

          await new Promise<void>((resolve, reject) => {
            openApiCmd.once('error', (err) => {
              reject(new Error(String(err)));
            });
            openApiCmd.once('exit', (code, signal) => {
              if (signal) {
                return reject(
                  new Error(`${openApiCmd.spawnargs.join(' ')} exited due to ${signal}`)
                );
              } else if (code !== undefined && code !== 0) {
                return reject(
                  new Error(`${openApiCmd.spawnargs.join(' ')} exited with code ${code}`)
                );
              }
              resolve();
            });
          });

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
