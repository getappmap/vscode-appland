import { PathLike, promises as fs } from 'fs';
import { join } from 'path';
import { exec } from '../util';
import AppMapAgent, { FilesResponse, StatusResponse, InstallResult } from './appMapAgent';

export default class AppMapAgentRuby implements AppMapAgent {
  readonly language = 'ruby';

  async install(path: PathLike): Promise<InstallResult> {
    const process = await exec('bundle', ['info', 'appmap'], { cwd: path as string });
    if (process.exitCode === 0) {
      // Already installed.
      //
      // TODO.
      // Consider upgrading.
      return 'none';
    }

    const gemfilePath = join(path as string, 'Gemfile');
    const gemfile = String(await fs.readFile(gemfilePath));
    const index = gemfile.search(/^\s*gem\s*/m);

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

  async init(path: PathLike): Promise<void> {
    await exec('bundle', ['exec', 'appmap-agent-init'], { cwd: path as string });
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
