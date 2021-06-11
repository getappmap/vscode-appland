import TelemetryDataProvider from './telemetryDataProvider';

// TODO.
// Where should TelemetryDataProviders be constructed? Here, or closer to the logical definition?
export const PROPERTIES = {
  PROJECT: {
    AGENT_VERSION_GLOBAL: new TelemetryDataProvider('appmap.project.agent_version_global', () =>
      Promise.resolve('')
    ),
    AGENT_VERSION_PROJECT: new TelemetryDataProvider('appmap.project.agent_version_project', () =>
      Promise.resolve('')
    ),
    IS_CONFIG_PRESENT: new TelemetryDataProvider('appmap.project.is_config_present', () =>
      Promise.resolve('')
    ),
    LANGUAGE: new TelemetryDataProvider('appmap.project.language', () => Promise.resolve('')),
  },
};

export const METRICS = {};
