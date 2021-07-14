import { PathLike } from 'fs';
import { exec, AgentExecOptions, AgentExecReturn } from '../util';
import AppMapAgent, {
  AppMapAgentBase,
  FilesResponse,
  InitResponse,
  InstallResult,
  StatusResponse,
} from './appMapAgent';

export default class AppMapAgentPython extends AppMapAgentBase implements AppMapAgent {
  readonly language = 'python';

  private async usesPoetry(path: PathLike): Promise<boolean> {
    const process = await exec('poetry', ['check'], { cwd: path as string });
    return process.exitCode === 0;
  }

  private async projectExec(
    path: PathLike,
    cmd: string,
    args: ReadonlyArray<string> | null | undefined,
    options?: AgentExecOptions | null | undefined
  ): Promise<AgentExecReturn> {
    if (this.usesPoetry(path)) {
      let newArgs = ['run', cmd];
      if (args !== undefined && args !== null) {
        newArgs = newArgs.concat(args);
      }
      cmd = 'poetry';
      args = newArgs;
      options = options ?? {};
      options.cwd = path as string;
      options.env = {
        ...process.env,
        ...options.env,
        APPMAP_AGENT_POETRY: 'true',
        APPMAP_LOG_LEVEL: 'info',
      };
    }
    return exec(cmd, args, options);
  }

  async isInstalled(path: PathLike): Promise<boolean> {
    const process = await this.projectExec(path, 'pip', ['show', 'appmap']);
    return process.exitCode === 0;
  }

  async install(path: PathLike): Promise<InstallResult> {
    if (this.usesPoetry(path)) {
      const installed = await this.isInstalled(path);
      const cmd = installed ? ['update'] : ['add', '--dev'];
      console.log(`install, cmd ${cmd}`);
      const pkg = '../../applandinc/appmap-python/dist/appmap-0.0.0-py3-none-any.whl';
      const { stderr, exitCode } = await exec('poetry', cmd.concat([pkg]), {
        cwd: path as string,
        output: true,
      });
      if (exitCode !== 0) {
        throw Error(stderr);
      }
      return 'installed';
    }
    throw new Error('Method not implemented.');
  }

  async init(path: PathLike): Promise<InitResponse> {
    const { stdout, stderr, exitCode } = await this.projectExec(path, 'appmap-agent-init', [], {
      cwd: path as string,
    });
    console.log(`init ${path}`);

    if (exitCode !== 0) {
      console.log(`init failed, ${stderr}`);
      throw new Error(stderr);
    }

    return this.writeConfig(path, stdout);
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  files(path: PathLike): Promise<FilesResponse> {
    throw new Error('Method not implemented.');
  }
  async status(path: PathLike): Promise<StatusResponse> {
    if (this.usesPoetry(path)) {
      const { stdout, stderr, exitCode } = await this.projectExec(path, 'appmap-agent-status', []);
      if (exitCode !== 0) {
        throw Error(stderr);
      }

      return JSON.parse(stdout);
    }
    throw new Error('Method not implemented.');
  }
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  test(path: PathLike): Promise<void> {
    throw new Error('Method not implemented.');
  }
}
