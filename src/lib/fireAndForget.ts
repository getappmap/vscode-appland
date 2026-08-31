/**
 * Executes an async operation or accepts a Promise, suppressing all rejections.
 */
export default function fireAndForget(task: Promise<unknown> | (() => Promise<unknown>)): void {
  const promise = typeof task === 'function' ? task() : task;

  promise.catch((err) => {
    console.warn('[fireAndForget] Suppressed error:', err);
  });
}
