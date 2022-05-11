export async function waitFor(
  message: string,
  test: () => boolean | Promise<boolean>,
  timeout = 30000,
  startTime = Date.now()
): Promise<void> {
  while (!test()) {
    const elapsed = Date.now() - startTime;
    if (elapsed > timeout) {
      throw new Error(message);
    }

    await wait(250);
  }
}

async function wait(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}
