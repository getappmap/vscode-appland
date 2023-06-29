import { EventEmitter } from 'stream';
import lockfile from 'proper-lockfile';
import assert from 'assert';
import { isNativeError } from 'util/types';

/**
 * This error is thrown when checking the status of a lockfile fails.
 */
export class LockfileStatusError extends Error {
  constructor(error: Error) {
    super(error.message);
    this.stack = error.stack;
  }
}

/**
 * This error is thrown when waiting for a lockfile to be released times out.
 */
export class TimeoutError extends Error {}

export type LockfileSynchronizerOptions = {
  waitTimeoutMs?: number; // The time (in milliseconds) a lock will wait before raising a TimeoutError
  pollIntervalMs?: number; // How often (in milliseconds) a waiting synchronizer will re-check for release of a lock
  pollIntervalMsNoise?: number; // The max range of milliseconds to add to the poll interval to add randomness
};

/**
 * This class provides a mechanism for synchronizing access to a resource across extension instances (processes).
 * Each window has its own extension instance, so this is useful for synchronizing access to resources that are
 * shared across windows.
 */
export default class LockfileSynchronizer extends EventEmitter {
  private readonly options: Required<LockfileSynchronizerOptions>;

  constructor(private readonly lockfilePath: string, options?: LockfileSynchronizerOptions) {
    super();

    this.options = {
      waitTimeoutMs: 5 * 60 * 1000,
      pollIntervalMs: 5000,
      pollIntervalMsNoise: 500,
      ...(options || {}),
    };
  }

  async tryLock(): Promise<(() => Promise<void>) | undefined> {
    try {
      return await lockfile.lock(this.lockfilePath);
    } catch (e) {
      assert(isNativeError(e));
      if ('code' in e && e.code === 'ELOCKED') return;
      throw e;
    }
  }

  async wait() {
    let giveUp = false;
    setTimeout(() => {
      giveUp = true;
    }, this.options.waitTimeoutMs).unref();

    let lastException: Error | undefined;
    while (!giveUp) {
      // Add a little randomness to avoid multiple processes checking all at once.
      const { pollIntervalMs, pollIntervalMsNoise } = this.options;
      const nextCheckMs = pollIntervalMs + Math.random() * pollIntervalMsNoise;
      await new Promise((resolve) => setTimeout(resolve, nextCheckMs));

      try {
        if (!(await lockfile.check(this.lockfilePath))) return;
      } catch (e) {
        assert(isNativeError(e));
        lastException = e;
        // On error, will just try again. After the time limit has elapsed
        // we can report the last error, if any.
      }
    }

    if (lastException) {
      // This is likely not resolvable as ENOENT is gracefully handled by the library.
      // The best we can do is log the error and continue on as best we can. It's possible there's
      // a viable installation already installed.
      throw new LockfileStatusError(lastException);
    }

    throw new TimeoutError(`Gave up waiting for ${this.lockfilePath} to be released`);
  }

  async execute(perform: () => void | Promise<void>): Promise<void> {
    let release: (() => Promise<void>) | undefined;
    try {
      release = await this.tryLock();
      if (release) {
        await perform();
      } else {
        this.emit('wait');
        await this.wait();
      }

      this.emit('success');
    } catch (e) {
      this.emit('error', e);
    } finally {
      if (release) release(); // intentionally no waiting
    }
  }
}
