import * as vscode from 'vscode';
import * as path from 'path';
import NodeRunner, { ProcessOutputType } from './nodeRunner';
import { DEBUG_EXCEPTION, Telemetry } from '../telemetry';
import { promises as fs } from 'fs';
import { WorkspaceService } from './workspaceService';
import NodeProcessServiceInstance from './nodeProcessServiceInstance';
import { ProcessWatcher } from './processWatcher';
import ExtensionSettings from '../configuration/extensionSettings';

const YARN_JS = 'yarn.js';

export class NodeProcessService implements WorkspaceService<NodeProcessServiceInstance> {
  protected node: NodeRunner;
  protected externDir: string;
  protected globalStorageDir: string;
  protected COPY_FILES: string[] = ['package.json', 'yarn.lock', YARN_JS];

  constructor(context: vscode.ExtensionContext) {
    this.node = new NodeRunner(context.globalStorageUri.fsPath);
    this.globalStorageDir = context.globalStorageUri.fsPath;
    this.externDir = path.join(context.extensionPath, 'extern');
  }

  async create(folder: vscode.WorkspaceFolder): Promise<NodeProcessServiceInstance> {
    const services: ProcessWatcher[] = [];

    if (ExtensionSettings.indexEnabled()) {
      try {
        const appmapBinPath = await this.binPath('appmap');
        services.push(
          new ProcessWatcher({
            args: [this.nodeArgs, appmapBinPath, ExtensionSettings.indexCommand()].flat(),
            env: this.env,
            cwd: folder.uri.fsPath,
          })
        );
      } catch (e) {
        Telemetry.sendEvent(DEBUG_EXCEPTION, { exception: e as Error });
      }
    }

    if (ExtensionSettings.findingsEnabled()) {
      try {
        const scannerBinPath = await this.binPath('scanner');
        services.push(
          new ProcessWatcher({
            args: [this.nodeArgs, scannerBinPath, ExtensionSettings.scanCommand()].flat(),
            env: this.env,
            cwd: folder.uri.fsPath,
          })
        );
      } catch (e) {
        Telemetry.sendEvent(DEBUG_EXCEPTION, { exception: e as Error });
      }
    }

    return new NodeProcessServiceInstance(folder, services);
  }

  protected get isElectronApp(): boolean {
    return !vscode.env.remoteName;
  }

  protected get nodeArgs(): string[] {
    return [process.argv[0], this.isElectronApp && '--ms-enable-electron-run-as-node'].filter(
      Boolean
    ) as string[];
  }

  protected get env(): NodeJS.ProcessEnv {
    const additionalEnv = { ...process.env };
    if (this.isElectronApp) {
      additionalEnv['ELECTRON_RUN_AS_NODE'] = 'true';
    }
    return additionalEnv;
  }

  protected get yarnPath(): string {
    return path.join(this.globalStorageDir, YARN_JS);
  }

  async binPath(dependency: string): Promise<string> {
    const output = await this.node.exec(this.yarnPath, 'bin', dependency);
    if (output.exitCode && output.exitCode !== 0) {
      throw new Error(
        [
          `failed to fetch bin path for ${dependency}`,
          output.log.map((l) => `[${l.type}] ${l.data}`),
        ].join('\n')
      );
    }
    return output.log
      .filter((l) => l.type === ProcessOutputType.Stdout)
      .map((l) => l.data)
      .join('\n')
      .trim();
  }

  async install(): Promise<void> {
    try {
      await fs.mkdir(this.globalStorageDir, { recursive: true });

      await Promise.all(
        this.COPY_FILES.map((fileName) =>
          fs.copyFile(
            path.join(this.externDir, fileName),
            path.join(this.globalStorageDir, fileName)
          )
        )
      );

      await fs.writeFile(
        path.join(this.globalStorageDir, '.yarnrc.yml'),
        ['nodeLinker: node-modules', 'npmRegistryServer: "https://registry.npmjs.org"'].join('\n')
      );

      const processOutput = await this.node.exec(this.yarnPath);
      if (processOutput.signal || (processOutput.exitCode && processOutput.exitCode !== 0)) {
        const message = [
          'Failed to install dependencies',
          `Exit code: ${processOutput.exitCode}`,
          `Signal: ${processOutput.signal}`,
          ...processOutput.log.map((log) => `${log.type}: ${log.data}`),
        ].join('\n');
        throw new Error(message);
      }
    } catch (e) {
      const err =
        e instanceof Error ? e : new Error(`failed to install node dependencies: ${String(e)}`);
      Telemetry.sendEvent(DEBUG_EXCEPTION, { exception: err });
    }
  }
}
