import { DEBUG_EXCEPTION, Telemetry } from '../telemetry';
import ErrorCode from '../telemetry/definitions/errorCodes';
import { ProcessWatcher } from './processWatcher';

export function reportProcessError(
  watcher: ProcessWatcher,
  error: Error,
  extra?: Record<string, unknown>
): void {
  Telemetry.sendEvent(DEBUG_EXCEPTION, {
    exception: error,
    errorCode: ErrorCode.ProcessFailure,
    log: watcher.process?.log.toString(),
    ...extra,
  });
}
