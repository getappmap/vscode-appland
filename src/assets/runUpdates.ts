import { mkdir } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join } from 'node:path';

import LockfileSynchronizer from '../lib/lockfileSynchronizer';
import * as log from './log';

export default async function runUpdates(
  updates: Array<() => Promise<void>>,
  throwOnError = false
): Promise<void> {
  if (updates.length === 0) return;

  const appmapDir = join(homedir(), '.appmap');
  await mkdir(appmapDir, { recursive: true });

  let holdingLock = false;
  let hasErrors = false;
  const sync = new LockfileSynchronizer(appmapDir);
  return new Promise<void>((resolve, reject) => {
    sync
      .on('wait', () => {
        log.info('Waiting for assets to be updated by another process...');
      })
      .on('error', (e) => {
        if (throwOnError) reject(e);
        hasErrors = true;
        log.error(e.stack);
      })
      .on('success', () => {
        if (!holdingLock) {
          log.info('Another process has completed the asset update.');
        } else if (hasErrors) {
          log.error('Asset update completed with errors.');
        } else {
          log.info('Asset update completed successfully.');
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
