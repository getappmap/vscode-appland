import { ChildProcess } from './nodeDependencyProcess';

// Attempts a graceful kill (SIGTERM by default), escalating to SIGKILL after `timeoutMs` if the
// process hasn't exited by then. Returns false if the process could not be signalled at all (e.g.
// it had already exited), true once the process has actually exited.
export async function killGracefully(proc: ChildProcess, timeoutMs = 1000): Promise<boolean> {
  const killTimer = setTimeout(() => proc.kill('SIGKILL'), timeoutMs).unref();
  const exited = new Promise<void>((resolve) =>
    proc.once('exit', () => {
      clearTimeout(killTimer);
      resolve();
    })
  );

  if (!proc.kill()) {
    clearTimeout(killTimer);
    return false;
  }

  await exited;
  return true;
}
