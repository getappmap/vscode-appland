import { expect } from '@playwright/test';
import backgroundJob from '../../src/lib/backgroundJob';
import { wait } from './util';

describe('backgroundJob', () => {
  let invocationCount = 0;

  function makeTestFunction(): () => Promise<number> {
    const result = async (): Promise<number> => {
      await wait(25);
      invocationCount += 1;
      return invocationCount;
    };
    return result;
  }

  beforeEach(() => {
    invocationCount = 0;
  });

  it('runs a simple function', async () => {
    const testFunction = makeTestFunction();
    const result = await backgroundJob('backgroundJob.test.1', testFunction, 0);
    expect(result).toEqual(1);
  });

  it('rapid-fire invocations run the same function instance', async () => {
    const testFunction = makeTestFunction();

    const results = await Promise.all([
      backgroundJob('backgroundJob.test.2', testFunction, 0),
      backgroundJob('backgroundJob.test.2', testFunction, 0),
      backgroundJob('backgroundJob.test.2', testFunction, 0),
    ]);

    expect(results).toEqual([1, 1, 1]);
  });

  it('spaced-out invocations run the function multiple times', async () => {
    const testFunction = makeTestFunction();

    const result1 = await backgroundJob('backgroundJob.test.3', testFunction, 0);
    const result2 = await backgroundJob('backgroundJob.test.3', testFunction, 0);

    expect([result1, result2]).toEqual([1, 2]);
  });
});
