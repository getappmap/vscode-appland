import { close, open, utimes } from 'fs';

export async function waitFor(
  message: string,
  test: () => boolean | Promise<boolean>,
  timeout = 10000,
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

export async function wait(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

export async function touch(path: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const time = new Date();
    utimes(path, time, time, (err) => {
      if (err) {
        return open(path, 'w', (err, fd) => {
          if (err) return reject(err);
          close(fd, (err) => (err ? reject(err) : resolve()));
        });
      }
      resolve();
    });
  });
}
