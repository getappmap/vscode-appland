import { PathLike, promises as fs } from 'fs';
import { Uri } from 'vscode';
import * as path from 'path';
import { createHash } from 'crypto';
import TelemetryDataProvider from '../telemetryDataProvider';
import Milestone from '../../milestones';
import LanguageResolver, { UNKNOWN_LANGUAGE } from '../../languageResolver';
import AppMapAgent from '../../agent/appMapAgent';
import yaml = require('js-yaml');

export const DEBUG_EXCEPTION = new TelemetryDataProvider({
  id: 'appmap.debug.exception',
  async value({ exception }: { exception: Error }): Promise<string> {
    return exception.stack || '';
  },
});

export const FILE_PATH = new TelemetryDataProvider({
  id: 'appmap.file.path',
  async value({ uri, rootDirectory }: { uri: Uri; rootDirectory?: PathLike }) {
    if (!rootDirectory) {
      // If we cannot resolve a relative path, bail out.
      return undefined;
    }

    try {
      return await path.relative(rootDirectory as string, uri.fsPath);
    } catch {
      return undefined;
    }
  },
});

export const FILE_SHA_256 = new TelemetryDataProvider({
  id: 'appmap.file.sha_256',
  async value({ uri }: { uri: Uri }) {
    return fs
      .access(uri.fsPath)
      .then(async () => {
        const hash = createHash('sha256');
        hash.update(await fs.readFile(uri.fsPath));
        return hash.digest('hex');
      })
      .catch(() => '');
  },
});

export const FILE_METADATA = new TelemetryDataProvider({
  id: 'appmap.file.metadata',
  async value({ metadata }: { metadata?: Record<string, unknown> }) {
    return metadata;
  },
});

export const MILESTONE_ID = new TelemetryDataProvider({
  id: 'appmap.milestone.id',
  async value({ milestone }: { milestone: Milestone }): Promise<string> {
    return milestone.id;
  },
});

export const MILESTONE_STATE = new TelemetryDataProvider({
  id: 'appmap.milestone.state',
  async value({ milestone }: { milestone: Milestone }): Promise<string> {
    return milestone.state;
  },
});

export const PROJECT_AGENT_VERSION = new TelemetryDataProvider({
  id: 'appmap.project.agent_version',
  proxyCache: ['agent'],
  async value({ agent, rootDirectory }: { agent?: AppMapAgent; rootDirectory: PathLike }) {
    try {
      const status = await agent?.status(rootDirectory);
      return status?.properties.project.agentVersion || 'none';
    } catch {
      return 'none';
    }
  },
});

export const PROJECT_IS_CONFIG_PRESENT = new TelemetryDataProvider({
  id: 'appmap.project.is_config_present',
  proxyCache: ['agent'],
  async value({ agent, rootDirectory }: { agent?: AppMapAgent; rootDirectory: PathLike }) {
    try {
      const status = await agent?.status(rootDirectory);
      return String(status?.properties.config.present || false);
    } catch {
      return 'false';
    }
  },
});

export const PROJECT_LANGUAGE = new TelemetryDataProvider({
  id: 'appmap.project.language',
  cache: true,
  proxyCache: ['agent'],
  async value(data: {
    agent?: AppMapAgent;
    rootDirectory?: PathLike;
    metadata?: Record<string, unknown>;
  }) {
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

    let agentLanguage;

    try {
      // First attempt to retrieve the language from the agent.
      const status = await data.agent?.status(data.rootDirectory);
      agentLanguage = status?.properties.project.language;
    } catch {
      // fall through
    }

    return (
      agentLanguage || (await LanguageResolver.getLanguage(data.rootDirectory)) || UNKNOWN_LANGUAGE
    );
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

export const CONFIG_IS_VALID = new TelemetryDataProvider({
  id: 'appmap.config.is_valid',
  proxyCache: ['agent'],
  async value({ agent, rootDirectory }: { agent?: AppMapAgent; rootDirectory: PathLike }) {
    try {
      const status = await agent?.status(rootDirectory);
      return String(status?.properties.config.valid || false);
    } catch {
      return 'false';
    }
  },
});

export const CONFIG_APP = new TelemetryDataProvider({
  id: 'appmap.config.app',
  proxyCache: ['agent'],
  async value({
    rootDirectory,
    name,
    config,
    uri,
    agent,
  }: {
    rootDirectory: PathLike;
    name?: string;
    config?: Record<string, unknown>;
    uri?: Uri;
    agent?: AppMapAgent;
  }) {
    if (name) {
      return name;
    }

    if (config?.name) {
      return config.name;
    }
    try {
      if (uri) {
        const parsedConfig = yaml.load(await fs.readFile(uri.fsPath, 'utf-8'));
        return parsedConfig?.name || undefined;
      }

      if (agent) {
        const status = await agent?.status(rootDirectory);
        return status?.properties.config.app || undefined;
      }
    } catch {
      return undefined;
    }

    return undefined;
  },
});

export const CONFIG_CONTENT = new TelemetryDataProvider({
  id: 'appmap.config.content',
  async value({ uri }: { uri: Uri }) {
    try {
      return await fs.readFile(uri.fsPath, 'utf-8');
    } catch {
      return undefined;
    }
  },
});
