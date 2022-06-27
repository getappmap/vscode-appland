import * as vscode from 'vscode';
import * as path from 'path';
import { DEBUG_EXCEPTION, Telemetry } from '../telemetry';
import { promises as fs } from 'fs';
import { WorkspaceService } from './workspaceService';
import NodeProcessServiceInstance from './nodeProcessServiceInstance';
import { ProcessWatcher } from './processWatcher';
import ExtensionSettings from '../configuration/extensionSettings';
import ErrorCode from '../telemetry/definitions/errorCodes';
import { Dependency, spawn } from './nodeDependencyProcess';

const YARN_JS = 'yarn.js';

export class NodeProcessService implements WorkspaceService<NodeProcessServiceInstance> {
  protected externDir: string;
  protected globalStorageDir: string;
  protected COPY_FILES: string[] = ['package.json', 'yarn.lock', YARN_JS];
  protected static outputChannel = vscode.window.createOutputChannel('AppMap: Services');

  protected _onReady = new vscode.EventEmitter<void>();
  get onReady(): vscode.Event<void> {
    return this._onReady.event;
  }

  constructor(context: vscode.ExtensionContext) {
    this.globalStorageDir = context.globalStorageUri.fsPath;
    this.externDir = path.join(context.extensionPath, 'extern');
  }

  async create(folder: vscode.WorkspaceFolder): Promise<NodeProcessServiceInstance> {
    const services: ProcessWatcher[] = [];

    if (ExtensionSettings.indexEnabled()) {
      try {
        services.push(
          new ProcessWatcher({
            bin: {
              dependency: Dependency.Appmap,
              globalStoragePath: this.globalStorageDir,
            },
            log: NodeProcessService.outputChannel,
            args: ['index', '--watch'],
            cwd: folder.uri.fsPath,
          })
        );
      } catch (e) {
        Telemetry.sendEvent(DEBUG_EXCEPTION, {
          exception: e as Error,
          errorCode: ErrorCode.DependencyPathNotResolved,
        });
      }
    }

    if (ExtensionSettings.findingsEnabled()) {
      try {
        services.push(
          new ProcessWatcher({
            bin: {
              dependency: Dependency.Scanner,
              globalStoragePath: this.globalStorageDir,
            },
            log: NodeProcessService.outputChannel,
            args: ['scan', '--watch'],
            cwd: folder.uri.fsPath,
          })
        );
      } catch (e) {
        Telemetry.sendEvent(DEBUG_EXCEPTION, {
          exception: e as Error,
          errorCode: ErrorCode.DependencyPathNotResolved,
        });
      }
    }

    return new NodeProcessServiceInstance(folder, services);
  }

  protected get yarnPath(): string {
    return path.join(this.globalStorageDir, YARN_JS);
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

      const installProcess = await spawn({
        args: [this.yarnPath, 'install'],
        cwd: this.globalStorageDir,
        log: NodeProcessService.outputChannel,
      });

      installProcess.log.append('Installing dependencies...');

      return new Promise((resolve, reject) => {
        installProcess.once('error', (err) => reject(err));
        installProcess.once('exit', (code, signal) => {
          if (code && code !== 0) {
            const message = [
              'Failed to install dependencies',
              `Exit code: ${code}`,
              `Signal: ${signal}`,
              installProcess.log.toString(),
            ].join('\n');
            reject(new Error(message));
          }

          installProcess.log.append('Installation of AppMap services is complete.');
          this._onReady.fire();
          resolve();
        });
      });
    } catch (e) {
      const err =
        e instanceof Error ? e : new Error(`failed to install node dependencies: ${String(e)}`);
      Telemetry.sendEvent(DEBUG_EXCEPTION, {
        exception: err,
        errorCode: ErrorCode.DependencyInstallFailure,
      });
    }
  }
}
