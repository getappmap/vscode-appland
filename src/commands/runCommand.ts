import * as vscode from 'vscode';

import {
  ProgramName,
  getModulePath,
  spawn,
  verifyCommandOutput,
} from '../services/nodeDependencyProcess';
import { DEBUG_EXCEPTION, Telemetry } from '../telemetry';
import ErrorCode from '../telemetry/definitions/errorCodes';

export default async function runCommand(
  context: vscode.ExtensionContext,
  errorCode: ErrorCode,
  errorMessage: string,
  args: string[],
  cwd: string
): Promise<boolean> {
  const modulePath = await getModulePath({
    dependency: ProgramName.Appmap,
    globalStoragePath: context.globalStorageUri.fsPath,
  });

  const command = spawn({
    modulePath,
    args,
    cwd,
  });
  try {
    await verifyCommandOutput(command);
    return true;
  } catch (e) {
    console.error(e);
    Telemetry.sendEvent(DEBUG_EXCEPTION, {
      exception: e as Error,
      errorCode: errorCode,
      log: command.log.toString(),
    });
    vscode.window.showWarningMessage(errorMessage);
    return false;
  }
}
