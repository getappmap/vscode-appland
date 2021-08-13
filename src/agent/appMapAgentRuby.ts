import { PathLike, promises as fs } from 'fs';
import { join } from 'path';
import semver from 'semver';
import { execFile, exec } from '../util';
import AppMapAgent, {
  FilesResponse,
  StatusResponse,
  InstallResult,
  InitResponse,
} from './appMapAgent';
import { agents as agentVersions } from '../../package.json';

export default class AppMapAgentRuby implements AppMapAgent {
  readonly language = 'ruby';
  private static readonly REGEX_GEM_DECLARATION = /(?!\s)(?:gem|group|require)\s/m;
  private static readonly REGEX_GEM_DEPENDENCY = /^\s*gem\s+['|"]appmap['|"].*$/m;
  private static readonly REGEX_GEM_VERSION = /appmap\s+\((\d+\.\d+\.\d+)\)/;
  private static readonly GEM_DEPENDENCY = "gem 'appmap', :groups => [:development, :test]";

  async isInstalled(path: PathLike): Promise<boolean> {
    try {
      const { stdout, exitCode } = await execFile('bundle', ['info', 'appmap'], {
        cwd: path as string,
      });

      if (exitCode !== 0) {
        return false;
      }

      const match = stdout.match(AppMapAgentRuby.REGEX_GEM_VERSION);
      const version = match ? match[1] : undefined;

      return version && semver.satisfies(version, agentVersions[this.language]);
    } catch (e) {
      return false;
    }
  }

  async install(path: PathLike): Promise<InstallResult> {
    const gemfilePath = join(path as string, 'Gemfile');
    let gemfile = String(await fs.readFile(gemfilePath));
    const index = gemfile.search(AppMapAgentRuby.REGEX_GEM_DECLARATION);

    if (index !== -1) {
      const gemExists = gemfile.search(AppMapAgentRuby.REGEX_GEM_DEPENDENCY) !== -1;

      if (gemExists) {
        // Replace the existing gem declaration entirely
        gemfile = gemfile.replace(
          AppMapAgentRuby.REGEX_GEM_DEPENDENCY,
          `\n${AppMapAgentRuby.GEM_DEPENDENCY}`
        );
      } else {
        // Insert a new gem declaration
        const chars = gemfile.split('');
        chars.splice(index, 0, `${AppMapAgentRuby.GEM_DEPENDENCY}\n\n`);
        gemfile = chars.join('');
      }

      await fs.writeFile(gemfilePath, gemfile);
    } else {
      await fs.writeFile(
        gemfilePath,
        gemfile + '\ngem "appmap", :groups => [:development, :test]\n'
      );
    }

    let error;

    try {
      const { exitCode } = await execFile('bundle', ['info', 'appmap'], { cwd: path as string });
      if (exitCode === 0) {
        // The gem is already present. Make sure it's up to date.
        const { stderr, exitCode } = await execFile('bundle', ['update', 'appmap'], {
          cwd: path as string,
          output: true,
        });

        if (exitCode !== 0) {
          error = stderr;
        }
      } else {
        // The gem is not present. Install it.
        const { stderr, exitCode } = await execFile('bundle', ['install'], {
          cwd: path as string,
          output: true,
        });

        if (exitCode !== 0) {
          error = stderr;
        }
      }
    } catch (e) {
      throw new Error(e);
    }

    if (error) {
      throw new Error(error);
    }

    return 'installed';
  }

  async init(path: PathLike): Promise<InitResponse> {
    const { stdout, stderr, exitCode } = await execFile('bundle', ['exec', 'appmap-agent-init'], {
      cwd: path as string,
    });

    if (exitCode !== 0) {
      throw new Error(stderr);
    }

    return JSON.parse(stdout);
  }

  async files(path: PathLike): Promise<FilesResponse> {
    const { stdout } = await execFile('bundle', ['exec', 'appmap-agent-files'], {
      cwd: path as string,
    });
    return JSON.parse(stdout);
  }

  async status(path: PathLike): Promise<StatusResponse> {
    const { stdout, stderr, exitCode } = await execFile('bundle', ['exec', 'appmap-agent-status'], {
      cwd: path as string,
    });

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
