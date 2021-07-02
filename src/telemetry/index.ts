import LanguageResolver from '../languageResolver';
import TelemetryContext from './telemetryContext';
import TelemetryDataProvider from './telemetryDataProvider';

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
        const status = await context.getStatus();
        return status?.properties.project.agentVersion || 'none';
      },
    }),
    IS_CONFIG_PRESENT: new TelemetryDataProvider({
      id: 'appmap.project.is_config_present',
      async value(context: TelemetryContext) {
        const status = await context.getStatus();
        return String(status?.properties.config.present || false);
      },
    }),
    LANGUAGE: new TelemetryDataProvider({
      id: 'appmap.project.language',
      async value(context: TelemetryContext) {
        const status = await context.getStatus();
        return status?.properties.project.language || context.language || 'unknown';
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
};

export const Metrics = {};

export { default as TelemetryResolver } from './telemetryResolver';
