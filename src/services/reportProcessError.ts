import { DEBUG_EXCEPTION, Telemetry } from '../telemetry';
import ErrorCode from '../telemetry/definitions/errorCodes';
import { ProcessWatcher } from './processWatcher';

export type ProcessErrorDetails = {
  errorCode?: ErrorCode;
  log?: string;
  version?: string;
};

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
