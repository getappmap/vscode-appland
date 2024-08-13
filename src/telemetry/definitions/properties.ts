import { PathLike, promises as fs } from 'fs';
import * as path from 'path';
import TelemetryDataProvider from '../telemetryDataProvider';
import { fileExists } from '../../util';
import ErrorCode from './errorCodes';
import ProjectMetadata from '../../workspace/projectMetadata';
import { TerminalConfig } from '../../commands/installAgent';
import * as vscode from 'vscode';
import { findRepository } from '../../lib/git';
import { workspaceServices } from '../../services/workspaceServices';
import { AppmapConfigManager } from '../../services/appmapConfigManager';
import { proxySettings } from '../../lib/proxySettings';

export const DEBUG_EXCEPTION = new TelemetryDataProvider({
  id: 'appmap.debug.exception',
  async value({ exception }: { exception: Error }): Promise<string> {
    return exception.stack ?? String(exception);
  },
});

export const DEBUG_ERROR_CODE = new TelemetryDataProvider({
  id: 'appmap.debug.error_code',
  async value({ errorCode }: { errorCode?: ErrorCode }): Promise<string> {
    return ErrorCode[errorCode || ErrorCode.Unknown];
  },
});

export const DEBUG_LOG = new TelemetryDataProvider({
  id: 'appmap.debug.log',
  async value({ log }: { log?: string }) {
    return log;
  },
});

export const AGENT_CONFIG_PRESENT = new TelemetryDataProvider({
  id: 'appmap.agent.config_present',
  async value({ uri }: { uri: vscode.Uri }) {
    const workspaceFolder = vscode.workspace.getWorkspaceFolder(uri);
    if (!workspaceFolder) return 'false';

    const configManager = workspaceServices().getServiceInstanceFromClass(
      AppmapConfigManager,
      workspaceFolder
    );

    const isPresent = !!(configManager && configManager.hasConfigFile);
    return String(isPresent);
  },
});

export const SCANNER_CONFIG_PRESENT = new TelemetryDataProvider({
  id: 'appmap.scanner.config_present',
  async value({ rootDirectory }: { rootDirectory: PathLike }) {
    const isPresent = await fileExists(path.join(rootDirectory.toString(), 'appland-scanner.yml'));
    return String(isPresent);
  },
});

export const PROXY_ENABLED = new TelemetryDataProvider({
  id: 'appmap.proxy.enabled',
  async value() {
    const settings = proxySettings();
    return String(settings.http_proxy || settings.https_proxy);
  },
});

export const PROXY_SETTINGS = new TelemetryDataProvider({
  id: 'appmap.proxy_settings',
  async value() {
    return JSON.stringify(proxySettings());
  },
});

export const PROJECT_PATH = new TelemetryDataProvider<{ rootDirectory: string }, string>({
  id: 'appmap.project.path',
  cache: false,
  value: ({ rootDirectory }) => rootDirectory,
});

export const VERSION_CONTROL_REPOSITORY = new TelemetryDataProvider({
  id: 'appmap.version_control.repository',
  cache: true,
  value({ uri }: { uri: vscode.Uri }) {
    return findRepository(uri);
  },
});

export const DEFAULT_TERMINALS = new TelemetryDataProvider({
  id: 'vscode.workspace.default_terminals',
  cache: true,
  async value({ defaultTerminals }: { defaultTerminals: TerminalConfig }) {
    return JSON.stringify(defaultTerminals);
  },
});

export const HAS_DEVCONTAINER = new TelemetryDataProvider({
  id: 'appmap.project.has_devcontainer',
  async value({ rootDirectory }: { rootDirectory: string }) {
    const devContainerPattern = new vscode.RelativePattern(
      rootDirectory,
      '{devcontainer,.devcontainer}.json'
    );
    const devContainerJson = await vscode.workspace.findFiles(
      devContainerPattern,
      '**/node_modules/**',
      1
    );
    const hasDevContainer = devContainerJson.length !== 0;
    return String(hasDevContainer);
  },
});

export const DEPENDENCIES = new TelemetryDataProvider({
  id: 'appmap.project',
  cache: true,
  async value({ project }: { project: ProjectMetadata }) {
    try {
      const packageJsonPath = path.join(project.path, 'package.json');
      const packageJsonFile = await fs.readFile(packageJsonPath, 'utf-8');
      const packageJson = JSON.parse(packageJsonFile);
      const result = {
        dependencies: Object.keys(packageJson.dependencies || {})
          .sort()
          .join(','),
        dev_dependencies: Object.keys(packageJson.devDependencies || {})
          .sort()
          .join(','),
      };

      // Don't emit an entry if the value is empty
      Object.entries(result).forEach(([k, v]) => {
        if (!v) delete result[k];
      });

      return result;
    } catch {
      // do nothing
      // the file may not event exist
    }
  },
});
