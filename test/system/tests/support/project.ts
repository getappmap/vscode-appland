import * as fs from 'fs-extra';
import minimatch from 'minimatch';

import { glob } from 'glob';
import * as path from 'path';
import * as tmp from 'tmp';

tmp.setGracefulCleanup();
export default class ProjectDirectory {
  private projectPath: string;
  private projectName: string;
  public readonly workspacePath: string;

  // Prepare a new directory to become a copy of the given project. It will be empty until reset is called.
  constructor(projectPath: string) {
    this.projectPath = projectPath;
    this.projectName = path.basename(this.projectPath);
    this.workspacePath = path.join(tmp.dirSync().name, this.projectName);
    fs.mkdirSync(this.workspacePath);
  }

  // Empty out the workspace for this project, then copy in files from the project.
  //
  // If excludes is given, it's an array of minimatch patterns. A file will be excluded if it matches any of the
  // patterns. NB: minimatch doesn't support a pattern indicating where a file is rooted. So, for example, passing
  // '/appmap.yml' will exclude *all* files named appmap.yml, anywhere in the source tree.
  async reset(...excludes: string[]): Promise<ProjectDirectory> {
    await fs.emptyDir(this.workspacePath);

    const filter = excludes ? (src: string) => !excludes.find((e) => minimatch(src, e)) : undefined;

    const cwd = process.cwd();
    process.chdir(this.projectPath);
    try {
      await fs.copy('.', this.workspacePath, { filter });
    } finally {
      process.chdir(cwd);
    }

    return this;
  }

  get appMapDirectoryPath(): string {
    return path.join(this.workspacePath, 'tmp', 'appmap');
  }

  get findingsFilePath(): string {
    return path.join(this.workspacePath, 'appmap-findings.json');
  }

  get configFilePath(): string {
    return path.join(this.workspacePath, 'appmap.yml');
  }

  async simulateAppMapInstall(): Promise<void> {
    const configContents = [
      `name: ${path.dirname(this.workspacePath)}`,
      `language: ruby`,
      `appmap_dir: ${this.appMapDirectoryPath}`,
    ].join('\n');

    await fs.writeFile(path.join(this.workspacePath, 'appmap.yml'), configContents);
  }

  async restoreFiles(pattern: string): Promise<void[]> {
    const matches = glob.sync(pattern, { cwd: this.projectPath });
    if (matches.length === 0) {
      throw new Error(`No matches in ${this.projectPath}} for ${pattern}`);
    }

    return Promise.all(
      matches.map(async (p) => {
        const src = path.join(this.projectPath, p);
        const target = path.join(this.workspacePath, p);
        await fs.ensureFile(target); // the file won't exist, but ensure that all the directories in the path do
        await fs.copyFile(src, target);
      })
    );
  }
}
