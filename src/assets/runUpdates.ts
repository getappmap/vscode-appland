import { mkdir } from 'node:fs/promises';

import LockfileSynchronizer from '../lib/lockfileSynchronizer';
import * as log from './log';

// Run `updates` in order while holding the lock at `lockPath`, so that only
// one extension instance (window) updates a given set of assets at a time.
// If another process already holds the lock, this waits for it to finish and
// resolves without running anything, on the assumption that the other process
// is doing the same work. Callers that update different things must therefore
// use different lock paths.
export default async function runUpdates(
  lockPath: string,
  updates: Array<() => Promise<void>>,
  throwOnError = false
): Promise<void> {
  if (updates.length === 0) return;

  await mkdir(lockPath, { recursive: true });

  let holdingLock = false;
  let hasErrors = false;
  const sync = new LockfileSynchronizer(lockPath);
  return new Promise<void>((resolve, reject) => {
    sync
      .on('wait', () => {
        log.info(`Waiting for ${lockPath} to be updated by another process...`);
      })
      .on('error', (e) => {
        if (throwOnError) reject(e);
        hasErrors = true;
        log.error(e.stack);
      })
      .on('success', () => {
        if (!holdingLock) {
          log.info(`Another process has completed the update of ${lockPath}.`);
        } else if (hasErrors) {
          log.error(`Update of ${lockPath} completed with errors.`);
        } else {
          log.info(`Update of ${lockPath} completed successfully.`);
        }
        resolve();
      })
      .execute(async () => {
        holdingLock = true;
        for (const update of updates) {
          try {
            await update();
          } catch (e) {
            sync.emit('error', e);
            if (e instanceof Error && e.name === 'AbortError') return reject(e);
          }
        }
      });
  });
}
