import { PathLike, promises as fs } from 'fs';
import { join } from 'path';
import { exec } from '../util';
import AppMapAgent, {
  FilesResponse,
  StatusResponse,
  InstallResult,
  InitResponse,
} from './appMapAgent';

export default class AppMapAgentRuby implements AppMapAgent {
  readonly language = 'ruby';

  async isInstalled(path: PathLike): Promise<boolean> {
    const process = await exec('bundle', ['info', 'appmap'], { cwd: path as string });
    return process.exitCode === 0;
  }

  async install(path: PathLike): Promise<InstallResult> {
    const isInstalled = await this.isInstalled(path);
    if (isInstalled) {
      // Already installed.
      //
      // TODO.
      // Consider upgrading.
      return 'none';
    }

    const gemfilePath = join(path as string, 'Gemfile');
    const gemfile = String(await fs.readFile(gemfilePath));
    const index = gemfile.search(/^\s*gem\s+/m);

    if (index !== -1) {
      const chars = gemfile.split('');
      chars.splice(index, 0, "\ngem 'appmap', :groups => [:development, :test]\n");
      await fs.writeFile(gemfilePath, chars.join(''));
    } else {
      await fs.writeFile(
        gemfilePath,
        gemfile + '\ngem "appmap", :groups => [:development, :test]\n'
      );
    }

    await exec('bundle', ['install'], { cwd: path as string, output: true });

    return 'installed';
  }

  async init(path: PathLike): Promise<InitResponse> {
    const { stdout } = await exec('bundle', ['exec', 'appmap-agent-init'], { cwd: path as string });
    const response = JSON.parse(stdout) as InitResponse;
    const { filename, contents } = response.configuration;

    await fs.writeFile(join(path as string, filename), contents);

    return response;
  }

  async files(path: PathLike): Promise<FilesResponse> {
    const { stdout } = await exec('bundle', ['exec', 'appmap-agent-files'], {
      cwd: path as string,
    });
    return JSON.parse(stdout);
  }

  async status(path: PathLike): Promise<StatusResponse> {
    const { stdout } = await exec('bundle', ['exec', 'appmap-agent-status'], {
      cwd: path as string,
    });
    return JSON.parse(stdout);
  }
}
