import { exec } from 'child_process';

export default async function filesModifiedInGit(cwd: string): Promise<string[]> {
  return new Promise<string[]>((resolve, reject) => {
    exec(`git ls-files -m`, { cwd }, (err, stdout) => {
      if (err && err.code && err.code > 0) reject(err.code);

      resolve(stdout.trim().split('\n'));
    });
  });
}
