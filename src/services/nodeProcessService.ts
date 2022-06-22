import * as vscode from 'vscode';
import * as path from 'path';
import NodeRunner from './nodeRunner';
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
      services.push(
        new ProcessWatcher({
          args: [
            ...this.args,
            ...[...ExtensionSettings.indexCommand()].map((a) =>
              a.trim() === '${PROJECT_DIR}' ? folder.uri.fsPath : a
            ),
          ],
          env: this.env,
          cwd: this.globalStorageDir,
        })
      );
    }

    if (ExtensionSettings.findingsEnabled()) {
      services.push(
        new ProcessWatcher({
          args: [
            ...this.args,
            ...[...ExtensionSettings.scanCommand()].map((a) =>
              a.trim() === '${PROJECT_DIR}' ? folder.uri.fsPath : a
            ),
          ],
          env: this.env,
          cwd: this.globalStorageDir,
        })
      );
    }

    return new NodeProcessServiceInstance(folder, services);
  }

  protected get isElectronApp(): boolean {
    return !vscode.env.remoteName;
  }

  protected get args(): string[] {
    return [
      process.argv[0],
      this.isElectronApp && '--ms-enable-electron-run-as-node',
      this.yarnPath,
      '--cwd',
      this.globalStorageDir,
    ].filter(Boolean) as string[];
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

  async install(): Promise<void> {
    await fs.mkdir(this.globalStorageDir, { recursive: true });

    await Promise.all(
      this.COPY_FILES.map((fileName) =>
        fs.copyFile(path.join(this.externDir, fileName), path.join(this.globalStorageDir, fileName))
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
      const exception = new Error(message);
      Telemetry.sendEvent(DEBUG_EXCEPTION, { exception });
      throw exception;
    }
  }
}
