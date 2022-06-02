import { exec } from 'child_process';
import { promises as fs } from 'fs';
import { glob } from 'glob';
import * as path from 'path';

const ignoreExceptions = async (fn: (...args: any[]) => any) => {
  try {
    return await fn();
  } catch {
    // Do nothing
  }
};

export default class ProjectDirectory {
  constructor(protected readonly projectPath: string) {}

  get appMapDirectoryPath(): string {
    return path.join(this.projectPath, 'tmp', 'appmap');
  }

  get findingsFilePath(): string {
    return path.join(this.projectPath, 'appmap-findings.yml');
  }

  get configFilePath(): string {
    return path.join(this.projectPath, 'appmap.yml');
  }

  async simulateAppMapInstall(): Promise<void> {
    const configContents = [
      `name: ${path.dirname(this.projectPath)}`,
      `language: ruby`,
      `appmap_dir: ${this.appMapDirectoryPath}`,
    ].join('\n');

    await fs.writeFile(path.join(this.projectPath, 'appmap.yml'), configContents);
  }

  async restoreFile(filePath: string): Promise<void> {
    const cmd = `git checkout ${path.relative(this.projectPath, filePath)}`;
    await new Promise((resolve) => exec(cmd, { cwd: this.projectPath }, resolve));
  }

  async removeAppMapFiles(): Promise<void> {
    await ignoreExceptions(async () => await fs.unlink(path.join(this.projectPath, 'appmap.yml')));
    await ignoreExceptions(
      async () => await fs.unlink(path.join(this.projectPath, 'appmap-findings.yml'))
    );

    return new Promise((resolve, reject) => {
      glob(
        path.join(this.appMapDirectoryPath, '**/*.appmap.json'),
        async (err: Error | null, matches: string[]) => {
          if (err) {
            reject(err);
            return;
          }

          await Promise.all(matches.map((match) => ignoreExceptions(() => fs.unlink(match))));
          resolve();
        }
      );
    });
  }

  async reset(): Promise<void> {
    const cmd = ['git restore .', 'git clean -fd'].join(' && ');
    await new Promise((resolve) => exec(cmd, { cwd: this.projectPath }, resolve));
  }
}
