export async function repeatUntil(
  fn: () => void | void[] | Promise<void> | Promise<void | void[]>,
  message: string,
  test: () => boolean | Promise<boolean>
): Promise<void> {
  const actionInterval = setInterval(fn, 1000);

  try {
    await waitFor(message, test);
  } finally {
    clearInterval(actionInterval);
  }
}

export async function waitFor(
  message: string,
  test: () => boolean | Promise<boolean> | Promise<void>,
  timeout = 30000
): Promise<void> {
  const startTime = Date.now();
  let delay = 100;
  let lastLoggedAt = 0;

  let exception: Error | undefined;
  let result: boolean | undefined | void;

  const check = async () => {
    try {
      result = await test();
      if (typeof result === 'boolean') return result;
      else return true;
    } catch (e) {
      exception = e as Error;
      return false;
    }
  };

  while (!(await check())) {
    const elapsed = Date.now() - startTime;
    if (elapsed > timeout) {
      if (exception) throw exception;
      else throw new Error(message);
    }

    delay = Math.min(Math.round(delay * 1.5), 2000);
    if (elapsed - lastLoggedAt >= 5000) {
      console.log(`Waiting for: ${message} (${Math.round(elapsed / 1000)}s elapsed)`);
      lastLoggedAt = elapsed;
    }
    await wait(delay);
  }
}

export async function wait(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}
