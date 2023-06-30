import { expect } from 'chai';
import LockfileSynchronizer, {
  LockfileStatusError,
  TimeoutError,
} from '../../../src/lib/lockfileSynchronizer';
import path from 'path';
import { promises as fs } from 'fs';
import { tmpdir } from 'os';

function createResolvablePromise() {
  let resolve: () => void;
  const promise = new Promise<void>((r) => {
    resolve = r;
  });
  return { promise, resolve: resolve! }; // eslint-disable-line @typescript-eslint/no-non-null-assertion
}

describe('LockfileSynchronizer', () => {
  const lockfilePath = path.join(tmpdir(), 'lockfile-test');
  const options = {
    wait: {
      waitTimeoutMs: 2000,
      pollIntervalMs: 1,
      pollIntervalMsNoise: 0,
    },
    immediate: {
      waitTimeoutMs: 0,
      pollIntervalMs: 0,
      pollIntervalMsNoise: 0,
    },
  };

  before(async () => {
    await fs.writeFile(lockfilePath, '');
  });

  after(async () => {
    await fs.rm(lockfilePath, { force: true });
  });

  describe('LockfileStatusError', () => {
    it('should capture the message and stack from the original error', () => {
      const originalError = new Error('Original error message');
      try {
        throw new LockfileStatusError(originalError);
      } catch (error) {
        expect(error).to.be.instanceOf(LockfileStatusError);
        const lockfileError = error as LockfileStatusError;
        expect(lockfileError.message).to.equal(originalError.message);
        expect(lockfileError.stack).to.equal(originalError.stack);
      }
    });
  });

  describe('waiting for lock to release', () => {
    let lockHolder: LockfileSynchronizer;
    let releaseLock: (() => void) | undefined;

    beforeEach(() => {
      const waitForTestCase = new Promise<void>((resolve) => {
        releaseLock = resolve;
      });
      lockHolder = new LockfileSynchronizer(lockfilePath);
      lockHolder.execute(() => waitForTestCase);
    });

    afterEach(
      () =>
        new Promise<void>((resolve) => {
          if (!releaseLock) return resolve();

          lockHolder.on('success', resolve);
          releaseLock();
        })
    );

    afterEach(async () => {
      try {
        // Ensure the lockfile doesn't remain between tests
        await fs.rm(`${lockfilePath}.lock`, { force: true, recursive: true });
      } catch (e) {
        console.error(e);
      }
    });

    it('throws a TimeoutError if the wait timeout is exceeded', () => {
      const sync = new LockfileSynchronizer(lockfilePath, options.immediate);
      return new Promise<void>((resolve) => {
        sync
          .on('error', (e) => {
            expect(e).to.be.instanceOf(TimeoutError);
            resolve();
          })
          .execute(() => expect.fail('should not have executed'));
      });
    });

    it('emits a wait event if the lock is not acquired', async () => {
      const sync = new LockfileSynchronizer(lockfilePath, options.immediate);
      await new Promise<void>((resolve) => {
        sync.on('wait', resolve).execute(() => expect.fail('should not have executed'));
      });
    });

    it('emits a success event after the lock is released', () => {
      const sync = new LockfileSynchronizer(lockfilePath, options.wait);
      return new Promise<void>((resolve) => {
        sync
          .on('wait', () => {
            releaseLock!(); // eslint-disable-line @typescript-eslint/no-non-null-assertion
            releaseLock = undefined;
          })
          .on('success', resolve)
          .execute(() => expect.fail('should not have executed'));
      });
    });
  });

  it('throws a LockfileStatusError if the file to be locked is missing', () => {
    const sync = new LockfileSynchronizer(`${lockfilePath}.missing`, options.immediate);
    return new Promise<void>((resolve, reject) => {
      sync
        .on('wait', () => reject(new Error('should not have waited')))
        .on('error', (e) => {
          expect(e).to.be.instanceOf(Error);
          expect(e.code).to.eq('ENOENT');
          resolve();
        })
        .execute(() => reject(new Error('should not have executed')));
    });
  });

  it('executes the provided function if the lock is acquired', async () => {
    const sync = new LockfileSynchronizer(lockfilePath, options.immediate);
    let executed = false;
    await sync.execute(() => {
      executed = true;
    });
    expect(executed).to.be.true;
  });

  it('only executes once', async () => {
    const syncs = Array.from(
      { length: 3 },
      () => new LockfileSynchronizer(lockfilePath, options.wait)
    );

    let numWaiting = 0;
    let numExecute = 0;
    let numSuccess = 0;

    const { promise: allReady, resolve: resolveAllReady } = createResolvablePromise();

    await Promise.all(
      syncs.map(
        (sync) =>
          new Promise<void>((resolve) =>
            sync
              .on('wait', () => {
                ++numWaiting;
                if (numWaiting === syncs.length - 1) {
                  // All but one are waiting, so we can resolve the promise to complete the lock holding `execute`.
                  resolveAllReady();
                }
              })
              .on('success', () => {
                ++numSuccess;
                resolve();
              })
              .execute(async () => {
                ++numExecute;
                await allReady;
              })
          )
      )
    );

    expect(numWaiting).to.equal(syncs.length - 1);
    expect(numSuccess).to.equal(syncs.length);
    expect(numExecute).to.equal(1);
  });
});
