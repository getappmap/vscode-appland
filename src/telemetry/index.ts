import LanguageResolver from '../languageResolver';
import TelemetryContext from './telemetryContext';
import TelemetryDataProvider from './telemetryDataProvider';
import * as path from 'path';
import { createHash } from 'crypto';
import fs from 'fs';

export const Properties = {
  Debug: {
    EXCEPTION: new TelemetryDataProvider({
      id: 'appmap.debug.exception',
      async value(context: TelemetryContext): Promise<string> {
        if (!context.event?.exception) {
          throw new Error('exception context was not provided');
        }

        return context.event.exception.stack || '';
      },
    }),
  },
  Milestones: {
    ID: new TelemetryDataProvider({
      id: 'appmap.milestone.id',
      async value(context: TelemetryContext): Promise<string> {
        if (!context.event?.milestone) {
          throw new Error('milestone context was not provided');
        }

        return context.event.milestone.id;
      },
    }),
    STATE: new TelemetryDataProvider({
      id: 'appmap.milestone.state',
      async value(context: TelemetryContext): Promise<string> {
        if (!context.event?.milestone) {
          throw new Error('milestone context was not provided');
        }

        return context.event.milestone.state;
      },
    }),
  },
  Project: {
    AGENT_VERSION: new TelemetryDataProvider({
      id: 'appmap.project.agent_version',
      async value(context: TelemetryContext) {
        try {
          const status = await context.getStatus();
          return status?.properties.project.agentVersion || 'none';
        } catch {
          return 'none';
        }
      },
    }),
    IS_CONFIG_PRESENT: new TelemetryDataProvider({
      id: 'appmap.project.is_config_present',
      async value(context: TelemetryContext) {
        try {
          const status = await context.getStatus();
          return String(status?.properties.config.present || false);
        } catch {
          return 'none';
        }
      },
    }),
    LANGUAGE: new TelemetryDataProvider({
      id: 'appmap.project.language',
      async value(context: TelemetryContext) {
        try {
          const status = await context.getStatus();
          return status?.properties.project.language || context.language || 'unknown';
        } catch {
          return context.language || 'none';
        }
      },
    }),
    LANGUAGE_DISTRIBUTION: new TelemetryDataProvider({
      id: 'appmap.project.language_distribution',
      async value(context: TelemetryContext) {
        const { rootDirectory } = context.event;
        if (!rootDirectory) {
          throw new Error('root directory must be provided');
        }

        const languageDistribution = await LanguageResolver.getLanguageDistribution(rootDirectory);
        return JSON.stringify(languageDistribution);
      },
    }),
  },
  File: {
    PATH: new TelemetryDataProvider({
      id: 'appmap.file.path',
      async value(context: TelemetryContext) {
        const { rootDirectory, file } = context.event;
        if (!rootDirectory || !file) {
          throw new Error('Root directory and file must be provided');
        }

        return path.relative(rootDirectory.toString(), file.toString());
      },
    }),
    SHA_256: new TelemetryDataProvider({
      id: 'appmap.file.sha_256',
      async value(context: TelemetryContext) {
        const { file } = context.event;
        if (!file) {
          throw new Error('File must be provided');
        }

        const hash = createHash('sha256');
        hash.update(await fs.promises.readFile(file));
        return hash.digest('hex');
      },
    }),
    METADATA: new TelemetryDataProvider({
      id: 'appmap.file.metadata',
      async value(context: TelemetryContext) {
        const { metadata } = context.event;
        if (!metadata) {
          throw new Error('AppMap metadata must be provided');
        }

        return JSON.stringify(metadata);
      },
    }),
  },
};

export const Metrics = {};

export { default as TelemetryResolver } from './telemetryResolver';
