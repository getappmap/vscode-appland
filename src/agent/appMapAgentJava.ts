import { existsSync, PathLike } from 'fs';
import { homedir } from 'os';
import { join } from 'path';
import { execFile, exec } from '../util';
import AppMapAgent, {
  FilesResponse,
  StatusResponse,
  InstallResult,
  InitResponse,
} from './appMapAgent';

interface BuildFramework {
  isInstalled(): Promise<boolean>;
}

class Maven implements BuildFramework {
  path: string;
  mavenCommand: string;

  constructor(path: string, mavenCommand: string) {
    this.path = path;
    this.mavenCommand = mavenCommand;
  }
  async isInstalled() {
    try {
      const { exitCode } = await execFile(this.mavenCommand, ['prepare-agent'], {
        cwd: this.path,
      });
      return exitCode === 0;
    } catch (e) {
      console.log(e);
      return false;
    }
  }
}

class Gradle implements BuildFramework {
  path: string;
  gradleCommand: string;

  constructor(path: string, gradleCommand: string) {
    this.path = path;
    this.gradleCommand = gradleCommand;
  }

  async isInstalled() {
    try {
      const { exitCode } = await execFile(this.gradleCommand, ['--help', 'appmap'], {
        cwd: this.path,
      });
      return exitCode === 0;
    } catch (e) {
      console.log(e);
      return false;
    }
  }
}

interface Installer {
  available: boolean;

  install(): Promise<InstallResult>;
}

class MavenInstaller implements Installer {
  path: string;

  constructor(path: string) {
    this.path = path;
  }

  get available() {
    return existsSync(join(this.path, 'pom.xml'));
  }

  install(): Promise<InstallResult> {
    return Promise.resolve('installed');
  }
}

class GradleInstaller implements Installer {
  path: string;

  constructor(path: string) {
    this.path = path;
  }

  get available() {
    return existsSync(join(this.path, 'build.gradle'));
  }

  install(): Promise<InstallResult> {
    return Promise.resolve('installed');
  }
}

export default class AppMapAgentJava implements AppMapAgent {
  readonly language = 'java';

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async isInstalled(path: PathLike): Promise<boolean> {
    return await Promise.all(
      [
        new Gradle(path as string, './gradlew'),
        new Gradle(path as string, './gradlew.bat'),
        new Maven(path as string, './mvnw'),
        new Maven(path as string, './mvnw.cmd'),
        new Maven(path as string, 'mvn'),
      ].map((framework) => framework.isInstalled())
    ).then((results) => results.some((r) => r));
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async install(path: PathLike): Promise<InstallResult> {
    function maybe(list: Array<InstallResult>, value: InstallResult) {
      return list.some((v) => v === value) ? value : null;
    }

    return Promise.all(
      [new GradleInstaller(path as string), new MavenInstaller(path as string)]
        .filter((installer) => installer.available)
        .map((installer) => installer.install())
    ).then(
      (installResults) =>
        maybe(installResults, 'installed') || maybe(installResults, 'upgraded') || 'none'
    );
  }

  get javaAgentPath(): string {
    return join(homedir(), 'lib/appmap.jar');
  }

  async init(path: PathLike): Promise<InitResponse> {
    const { stdout, stderr, exitCode } = await execFile(
      'java',
      ['-jar', this.javaAgentPath, '-d', '.', 'init'],
      {
        cwd: path as string,
      }
    );

    if (exitCode !== 0) {
      throw new Error(stderr);
    }

    return JSON.parse(stdout);
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async files(path: PathLike): Promise<FilesResponse> {
    return JSON.parse('{}');
  }

  async status(path: PathLike): Promise<StatusResponse> {
    const { stdout, stderr, exitCode } = await execFile(
      'java',
      ['-jar', this.javaAgentPath, '-d', '.', 'status'],
      {
        cwd: path as string,
      }
    );

    if (exitCode !== 0) {
      throw new Error(stderr);
    }

    return JSON.parse(stdout);
  }

  async test(path: PathLike, command: Array<string>): Promise<void> {
    return await command.forEach(async (row) => {
      await exec(row, {
        cwd: path as string,
        output: true,
        userCanTerminate: true,
        progressMessage: 'Recording tests...',
      });
    });
  }
}
