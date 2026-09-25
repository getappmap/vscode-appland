import { DEBUG_EXCEPTION, Telemetry } from '../telemetry';
import ErrorCode from '../telemetry/definitions/errorCodes';
import diagnoseExecutable from './diagnoseExecutable';
import { ProcessWatcher, ProcessWatcherOptions } from './processWatcher';

export type ProcessErrorDetails = {
  errorCode?: ErrorCode;
  log?: string;
  version?: string;
  diagnosis?: string;
};

// Everything the watcher still holds, read before the caller yields to anything: it lets go
// of the process as it aborts, and again while it backs off before a retry.
export function captureProcessDetails(watcher: ProcessWatcher): ProcessErrorDetails {
  return { log: watcher.process?.log.toString() };
}

// Worth asking only about a native binary: a node module that won't run says so on stderr,
// while a binary the system refuses to execute is killed with nothing to show for it.
export async function diagnoseWatcherExecutable(
  options: Pick<ProcessWatcherOptions, 'modulePath' | 'binPath'>
): Promise<string | undefined> {
  if (options.modulePath) return undefined;
  return JSON.stringify(await diagnoseExecutable(options.binPath));
}

export function reportProcessError(
  watcher: ProcessWatcher,
  error: Error,
  details?: ProcessErrorDetails
): void {
  Telemetry.sendEvent(DEBUG_EXCEPTION, {
    exception: error,
    errorCode: ErrorCode.ProcessFailure,
    // Only correct for a caller that reaches this synchronously: the watcher lets go of the
    // process as it aborts, and again while it backs off before a retry, so there is no log
    // left to read a tick later. A caller that awaits anything on the way here has to
    // capture the log itself and pass it in.
    log: watcher.process?.log.toString(),
    ...details,
  });
}
