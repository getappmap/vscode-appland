import { PathLike, promises as fs } from 'fs';
import { join } from 'path';
import { chainPromises, exec } from '../util';
import AppMapAgent, {
  FilesResponse,
  StatusResponse,
  InstallResult,
  InitResponse,
  AppMapAgentBase,
} from './appMapAgent';

export default class AppMapAgentRuby extends AppMapAgentBase implements AppMapAgent {
  readonly language = 'ruby';
  private static readonly REGEX_GEM_DECLARATION = /(?!\s)(?:gem|group|require)\s/m;
  private static readonly REGEX_GEM_DEPENDENCY = /^\s*gem\s+['|"]appmap['|"].*$/m;
  private static readonly GEM_DEPENDENCY = "gem 'appmap', :groups => [:development, :test]";

  async isInstalled(path: PathLike): Promise<boolean> {
    const process = await exec('bundle', ['info', 'appmap'], { cwd: path as string });
    return process.exitCode === 0;
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

    if (await this.isInstalled(path)) {
      const { stderr, exitCode } = await exec('bundle', ['update', 'appmap'], {
        cwd: path as string,
        output: true,
      });

      if (exitCode !== 0) {
        throw new Error(stderr);
      }
    } else {
      const { stderr, exitCode } = await exec('bundle', ['install'], {
        cwd: path as string,
        output: true,
      });

      if (exitCode !== 0) {
        throw new Error(stderr);
      }
    }

    return 'installed';
  }

  async init(path: PathLike): Promise<InitResponse> {
    const { stdout, stderr, exitCode } = await exec('bundle', ['exec', 'appmap-agent-init'], {
      cwd: path as string,
    });

    if (exitCode !== 0) {
      throw new Error(stderr);
    }

    return this.writeConfig(path, stdout);
  }

  async files(path: PathLike): Promise<FilesResponse> {
    const { stdout } = await exec('bundle', ['exec', 'appmap-agent-files'], {
      cwd: path as string,
    });
    return JSON.parse(stdout);
  }

  async status(path: PathLike): Promise<StatusResponse> {
    const { stdout, stderr, exitCode } = await exec('bundle', ['exec', 'appmap-agent-status'], {
      cwd: path as string,
    });

    if (exitCode !== 0) {
      throw new Error(stderr);
    }

    return JSON.parse(stdout);
  }

  async test(path: PathLike): Promise<void> {
    const status = await this.status(path);

    await chainPromises(
      ({ stderr, exitCode }) => {
        if (exitCode !== 0) {
          throw new Error(stderr);
        }
      },
      ...status.test_commands.map(
        async ({ command }) =>
          await exec(command.program, command.args, {
            cwd: path as string,
            output: true,
            env: {
              ...process.env,
              ...command.environment,
            },
          })
      )
    );
  }
}
