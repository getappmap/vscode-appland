import TelemetryContext from './telemetryContext';
import TelemetryDataProvider from './telemetryDataProvider';

export const Properties = {
  Project: {
    AGENT_VERSION_GLOBAL: new TelemetryDataProvider({
      id: 'com.project.agent_version_global',
      async value(context: TelemetryContext) {
        const status = await context.getStatus();
        return status?.properties.project.agentVersionGlobal || 'none';
      },
    }),
    AGENT_VERSION_PROJECT: new TelemetryDataProvider({
      id: 'com.project.agent_version_project',
      async value(context: TelemetryContext) {
        const status = await context.getStatus();
        return status?.properties.project.agentVersionProject || 'none';
      },
    }),
    IS_CONFIG_PRESENT: new TelemetryDataProvider({
      id: 'com.project.is_config_present',
      async value(context: TelemetryContext) {
        const status = await context.getStatus();
        return String(status?.properties.config.present || false);
      },
    }),
    LANGUAGE: new TelemetryDataProvider({
      id: 'com.project.language',
      async value(context: TelemetryContext) {
        const status = await context.getStatus();
        return status?.properties.project.language || context.language || 'unknown';
      },
    }),
  },
};

export const Metrics = {};

export { default as TelemetryResolver } from './telemetryResolver';
