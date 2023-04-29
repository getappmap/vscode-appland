import assert from 'assert';
import { AllProcessIds, DEFAULT_RETRY_OPTIONS } from '../../../src/services/processWatcher';
import { withAuthenticatedUser } from '../util';
import { getBackgroundProcesses, waitForDown, waitForUp } from './util';

// This test resides in its own file because we want to run it in isolation.
// Otherwise we don't know how many times processes have crashed due to other tests.
describe('Background processes', () => {
  withAuthenticatedUser();

  before(getBackgroundProcesses);

  it('eventually aborts if a process crashes too many times', async () => {
    const expectedTimesUp = DEFAULT_RETRY_OPTIONS.retryTimes + 1;
    let lastPids: Array<number | undefined> | undefined;
    for (let i = 0; i < expectedTimesUp; ++i) {
      await waitForUp(AllProcessIds, lastPids);
      const backgroundProcesses = Object.values(await getBackgroundProcesses());
      lastPids = backgroundProcesses.map((p) => p.process?.pid);
      assert.ok(lastPids.every((pid) => pid !== undefined));
      assert.ok(
        backgroundProcesses.map((p) => p.process?.kill()).every((killed) => killed),
        'every process is killed'
      );
    }

    // Wait ten seconds to make sure the processes don't come back up
    await new Promise((resolve) => setTimeout(resolve, 10 * 1000));
    await waitForDown();
  });
});
