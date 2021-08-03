import { PathLike, promises as fs } from 'fs';
import { TextDocument, Uri } from 'vscode';
import * as path from 'path';
import { createHash } from 'crypto';
import TelemetryDataProvider from '../telemetryDataProvider';
import Milestone from '../../milestones';
import LanguageResolver, { UNKNOWN_LANGUAGE } from '../../languageResolver';
import AppMapAgent from '../../agent/appMapAgent';
import { stringify } from 'querystring';

export default {
  Debug: {
    EXCEPTION: new TelemetryDataProvider({
      id: 'appmap.debug.exception',
      async value({ exception }: { exception: Error }): Promise<string> {
        return exception.stack || '';
      },
    }),
  },
  File: {
    PATH: new TelemetryDataProvider({
      id: 'appmap.file.path',
      async value({ uri, rootDirectory }: { uri: Uri; rootDirectory?: PathLike }) {
        if (!rootDirectory) {
          // If we cannot resolve a relative path, bail out.
          return undefined;
        }

        return path.relative(rootDirectory as string, uri.fsPath);
      },
    }),
    SHA_256: new TelemetryDataProvider({
      id: 'appmap.file.sha_256',
      async value({ uri }: { uri: Uri }) {
        const hash = createHash('sha256');
        hash.update(await fs.readFile(uri.fsPath));
        return hash.digest('hex');
      },
    }),
    METADATA: new TelemetryDataProvider({
      id: 'appmap.file.metadata',
      async value({ metadata }: { metadata?: Record<string, unknown> }) {
        return metadata;
      },
    }),
  },
  Milestones: {
    ID: new TelemetryDataProvider({
      id: 'appmap.milestone.id',
      async value({ milestone }: { milestone: Milestone }): Promise<string> {
        return milestone.id;
      },
    }),
    STATE: new TelemetryDataProvider({
      id: 'appmap.milestone.state',
      async value({ milestone }: { milestone: Milestone }): Promise<string> {
        return milestone.state;
      },
    }),
  },
  JSON: {
    // Untested - proof of concept
    METADATA: new TelemetryDataProvider({
      id: 'appmap.json.metadata',
      async value({ document }: { document: TextDocument }): Promise<Record<string, string>> {
        const data = JSON.parse(document.getText());
        return data.metadata || {};
      },
    }),
  },
  Project: {
    AGENT_VERSION: new TelemetryDataProvider({
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
    }),
    IS_CONFIG_PRESENT: new TelemetryDataProvider({
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
    }),
    LANGUAGE: new TelemetryDataProvider({
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
          agentLanguage ||
          (await LanguageResolver.getLanguage(data.rootDirectory)) ||
          UNKNOWN_LANGUAGE
        );
      },
    }),
    LANGUAGE_DISTRIBUTION: new TelemetryDataProvider({
      id: 'appmap.project.language_distribution',
      cache: true,
      async value({ rootDirectory }: { rootDirectory: PathLike }) {
        const languageDistribution = await LanguageResolver.getLanguageDistribution(rootDirectory);
        return JSON.stringify(languageDistribution);
      },
    }),
  },
};
