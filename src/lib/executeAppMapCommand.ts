import * as vscode from 'vscode';
import {
  ProgramName,
  SpawnOptions,
  getModulePath,
  spawn,
  verifyCommandOutput,
} from '../services/nodeDependencyProcess';
import { log } from 'console';
import { DEBUG_EXCEPTION, Telemetry } from '../telemetry';
import ErrorCode from '../telemetry/definitions/errorCodes';

export type CommandOptions = {
  cwd?: string;
  env?: NodeJS.ProcessEnv;
};

export default async function executeAppMapCommand(
  context: vscode.ExtensionContext,
  workspaceFolder: vscode.WorkspaceFolder,
  args: string[],
  warningMessage: string,
  options: CommandOptions = {}
) {
  const modulePath = await getModulePath({
    dependency: ProgramName.Appmap,
    globalStoragePath: context.globalStorageUri.fsPath,
  });

  const cwd = options.cwd || workspaceFolder.uri.fsPath;

  const cmdArgs: SpawnOptions = {
    modulePath,
    args,
    cwd,
    saveOutput: true,
  };

  if (options.env) cmdArgs.env = options.env;

  log(JSON.stringify(cmdArgs, null, 2));
  const command = spawn(cmdArgs);
  try {
    await verifyCommandOutput(command);
  } catch (e) {
    Telemetry.sendEvent(DEBUG_EXCEPTION, {
      exception: e as Error,
      errorCode: ErrorCode.CommandFailure,
      log: command.log.toString(),
    });
    vscode.window.showWarningMessage(warningMessage);
    return;
  }
}
