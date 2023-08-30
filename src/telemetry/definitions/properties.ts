import { PathLike, promises as fs } from 'fs';
import * as path from 'path';
import TelemetryDataProvider from '../telemetryDataProvider';
import LanguageResolver, { UNKNOWN_LANGUAGE } from '../../services/languageResolver';
import { fileExists } from '../../util';
import ErrorCode from './errorCodes';
import ProjectMetadata, { isLanguageSupported } from '../../workspace/projectMetadata';
import { TerminalConfig } from '../../commands/installAgent';
import * as vscode from 'vscode';
import { findRepository } from '../../lib/git';
import { workspaceServices } from '../../services/workspaceServices';
import { AppmapConfigManager } from '../../services/appmapConfigManager';
import ProjectStateService from '../../services/projectStateService';

export const DEBUG_EXCEPTION = new TelemetryDataProvider({
  id: 'appmap.debug.exception',
  async value({ exception }: { exception: Error }): Promise<string> {
    return exception.stack || '';
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

export const PROJECT_LANGUAGE = new TelemetryDataProvider({
  id: 'appmap.project.language',
  cache: false,
  value(data: {
    rootDirectory?: string;
    metadata?: Record<string, unknown>;
    project?: ProjectMetadata;
  }) {
    // If metadata is available, use the language property.
    // TODO: what is this record string,unknown?
    if (data.metadata) {
      const language = data.metadata.language as Record<string, string> | undefined;
      if (language?.name) {
        return language.name;
      }
    }

    if (data.project?.language?.name) {
      return data.project.language.name.toLowerCase();
    }

    // If no root directory is specified, we cannot resolve a langauge, so exit early.
    if (!data.rootDirectory) {
      return UNKNOWN_LANGUAGE;
    }

    const workspaceFolder = vscode.workspace.getWorkspaceFolder(
      vscode.Uri.file(data.rootDirectory)
    );
    if (!workspaceFolder) {
      return UNKNOWN_LANGUAGE;
    }
    const projectStateService = workspaceServices().getServiceInstanceFromClass(
      ProjectStateService,
      workspaceFolder
    );
    if (!projectStateService) {
      return UNKNOWN_LANGUAGE;
    }

    return projectStateService.metadata?.language?.name?.toLowerCase() || UNKNOWN_LANGUAGE;
  },
});

export const WEB_FRAMEWORK = new TelemetryDataProvider({
  id: 'appmap.project.web_framework',
  async value({ project }: { project: ProjectMetadata }) {
    return project?.webFramework?.name;
  },
});

export const TEST_FRAMEWORK = new TelemetryDataProvider({
  id: 'appmap.project.test_framework',
  async value({ project }: { project: ProjectMetadata }) {
    return project?.testFramework?.name;
  },
});

export const PROJECT_LANGUAGE_DISTRIBUTION = new TelemetryDataProvider({
  id: 'appmap.project.language_distribution',
  cache: true,
  async value({ rootDirectory }: { rootDirectory: string }) {
    const languageDistribution = await LanguageResolver.getLanguageDistribution(rootDirectory);
    return JSON.stringify(languageDistribution);
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

export const IS_INSTALLABLE = new TelemetryDataProvider({
  id: 'appmap.project.installable',
  async value({ project }: { project: ProjectMetadata }) {
    return String(isLanguageSupported(project));
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
