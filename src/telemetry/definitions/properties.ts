import { PathLike, promises as fs } from 'fs';
import { Uri } from 'vscode';
import * as path from 'path';
import { createHash } from 'crypto';
import TelemetryDataProvider from '../telemetryDataProvider';
import LanguageResolver, { UNKNOWN_LANGUAGE } from '../../services/languageResolver';
import { fileExists } from '../../util';
import ErrorCode from './errorCodes';
import ProjectMetadata from '../../workspace/projectMetadata';
import { TerminalConfig } from '../../commands/installAgent';

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

export const VIEW_ID = new TelemetryDataProvider({
  id: 'appmap.view.id',
  async value({ viewId }: { viewId: string }): Promise<string> {
    return viewId;
  },
});

export const TEXT = new TelemetryDataProvider({
  id: 'appmap.text',
  async value({ text }: { text: string }): Promise<string> {
    return text;
  },
});

export const CTA_ID = new TelemetryDataProvider({
  id: 'appmap.cta.id',
  async value({ id }: { id: string }): Promise<string> {
    return id;
  },
});

export const CTA_PLACEMENT = new TelemetryDataProvider({
  id: 'appmap.cta.placement',
  async value({ placement }: { placement: 'notification' | 'sidebar' }): Promise<string> {
    return placement;
  },
});

export const FILE_PATH = new TelemetryDataProvider({
  id: 'appmap.file.path',
  async value({ uri, rootDirectory }: { uri: Uri; rootDirectory?: PathLike }) {
    if (!rootDirectory) {
      // If we cannot resolve a relative path, bail out.
      return undefined;
    }

    return path.relative(rootDirectory as string, uri.fsPath);
  },
});

export const FILE_SHA_256 = new TelemetryDataProvider({
  id: 'appmap.file.sha_256',
  async value({ uri }: { uri: Uri }) {
    const hash = createHash('sha256');
    hash.update(await fs.readFile(uri.fsPath));
    return hash.digest('hex');
  },
});

export const FILE_SIZE = new TelemetryDataProvider({
  id: 'appmap.file.size',
  async value({ uri }: { uri: Uri }) {
    return (await fs.stat(uri.fsPath)).size.toString();
  },
});

export const FILE_METADATA = new TelemetryDataProvider({
  id: 'appmap.file.metadata',
  async value({ metadata }: { metadata?: Record<string, unknown> }) {
    return metadata;
  },
});

export const AGENT_CONFIG_PRESENT = new TelemetryDataProvider({
  id: 'appmap.agent.config_present',
  async value({ rootDirectory }: { rootDirectory: PathLike }) {
    const isPresent = await fileExists(path.join(rootDirectory.toString(), 'appmap.yml'));
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
  cache: true,
  async value(data: { rootDirectory?: string; metadata?: Record<string, unknown> }) {
    // If metadata is available, use the language property.
    if (data.metadata) {
      const language = data.metadata.language as Record<string, string> | undefined;
      if (language?.name) {
        return language.name;
      }
    }

    // If no root directory is specified, we cannot resolve a langauge, so exit early.
    if (!data.rootDirectory) {
      return UNKNOWN_LANGUAGE;
    }

    return (await LanguageResolver.getLanguage(data.rootDirectory)) || UNKNOWN_LANGUAGE;
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

export const RECORDING_ENDPOINT_URL = new TelemetryDataProvider({
  id: 'appmap.remote_recording.endpoint_url',
  async value({ url }: { url: string }) {
    return url;
  },
});

export const RECORDING_STATUS_CODE = new TelemetryDataProvider({
  id: 'appmap.remote_recording.status_code',
  async value({ code }: { code: number }) {
    return String(code);
  },
});

export const IS_TELEMETRY_ENABLED = new TelemetryDataProvider({
  id: 'appmap.enabled',
  async value({ enabled }: { enabled: boolean }) {
    return String(enabled);
  },
});

export const IS_INSTALLABLE = new TelemetryDataProvider({
  id: 'appmap.project.installable',
  async value({ project }: { project: ProjectMetadata }) {
    const isInstallable = project?.score && project.score > 1;
    return String(isInstallable);
  },
});

export const HAS_INSTALLABLE_PROJECT = new TelemetryDataProvider({
  id: 'appmap.project.any_installable',
  async value({ projects }: { projects: ProjectMetadata[] }) {
    const isInstallable = projects.some((project) => project?.score && project.score > 1);
    return String(isInstallable);
  },
});

export const DEFAULT_TERMINALS = new TelemetryDataProvider({
  id: 'vscode.workspace.default_terminals',
  cache: true,
  async value({ defaultTerminals }: { defaultTerminals: TerminalConfig }) {
    return JSON.stringify(defaultTerminals);
  },
});
