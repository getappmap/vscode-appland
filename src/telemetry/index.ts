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
    AGENT_VERSION_GLOBAL: new TelemetryDataProvider({
      id: 'appmap.project.agent_version_global',
      async value(context: TelemetryContext) {
        const status = await context.getStatus();
        return status?.properties.project.agentVersionGlobal || 'none';
      },
    }),
    AGENT_VERSION_PROJECT: new TelemetryDataProvider({
      id: 'appmap.project.agent_version_project',
      async value(context: TelemetryContext) {
        const status = await context.getStatus();
        return status?.properties.project.agentVersionProject || 'none';
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
  },
};

export const Metrics = {};

export { default as TelemetryResolver } from './telemetryResolver';
