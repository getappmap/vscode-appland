import { exec } from 'child_process';

export default async function filesUnknownToGit(cwd: string): Promise<string[]> {
  return new Promise<string[]>((resolve, reject) => {
    exec(`git ls-files -o --exclude-standard`, { cwd }, (err, stdout) => {
      if (err && err.code && err.code > 0) reject(err.code);

      resolve(stdout.trim().split('\n'));
    });
  });
}
