import * as os from 'os';

export function getOsShortcut(shortcut: string): string {
  return os.platform() === 'darwin' ? shortcut.replace(/[Cc]ontrol/, 'Meta') : shortcut;
}

export interface TimeoutOptions {
  timeoutMs?: number;
  retryIntervalMs?: number;
}

export function timeout<T>(fn: () => T, options?: TimeoutOptions): Promise<T> {
  const timeoutMs = options?.timeoutMs ?? 30000;
  const retryIntervalMs = options?.retryIntervalMs ?? 100;

  return new Promise((resolve, reject) => {
    const valueResolver = (value: T) => {
      if (value) {
        clearInterval(intervalHandle);
        resolve(value);
      }
    };

    const intervalHandle = setInterval(() => {
      console.error('trying timeout fn');
      const value = fn();
      value instanceof Promise ? value.then(valueResolver) : valueResolver(value);
    }, retryIntervalMs);

    setTimeout(() => {
      clearInterval(intervalHandle);
      reject(new Error(`timeout reached (${timeoutMs}ms)`));
    }, timeoutMs);
  });
}

export async function ignoreNotFound(fn: (...args: any[]) => any): Promise<void> {
  try {
    return await fn();
  } catch (e) {
    if ((e as any).code !== 'ENOENT') {
      throw e;
    }
  }
}
