import { PathLike, promises as fs } from 'fs';
import { Uri } from 'vscode';
import * as path from 'path';
import { createHash } from 'crypto';
import TelemetryDataProvider from '../telemetryDataProvider';
import LanguageResolver, { UNKNOWN_LANGUAGE } from '../../languageResolver';
import { fileExists } from '../../util';

export const DEBUG_EXCEPTION = new TelemetryDataProvider({
  id: 'appmap.debug.exception',
  async value({ exception }: { exception: Error }): Promise<string> {
    return exception.stack || '';
  },
});

export const VIEW_ID = new TelemetryDataProvider({
  id: 'appmap.view.id',
  async value({ viewId }: { viewId: string }): Promise<string> {
    return viewId;
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
    return (await fs.stat(uri.fsPath)).size;
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
  async value(data: { rootDirectory?: PathLike; metadata?: Record<string, unknown> }) {
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
  async value({ rootDirectory }: { rootDirectory: PathLike }) {
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
