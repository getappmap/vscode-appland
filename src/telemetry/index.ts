import {
  providerAgentVersionGlobal,
  providerAgentVersionProject,
  providerIsConfigPresent,
  providerLanguage,
} from './properties/project';

export const Properties = {
  Project: {
    AGENT_VERSION_GLOBAL: providerAgentVersionGlobal,
    AGENT_VERSION_PROJECT: providerAgentVersionProject,
    IS_CONFIG_PRESENT: providerIsConfigPresent,
    LANGUAGE: providerLanguage,
  },
};

export const Metrics = {};

export { default as TelemetryResolver } from './telemetryResolver';

/*

const telemetry = new TelemetryResolver(workspaceUri.fsPath);
return telemetry.resolve({
  Properties.Project.AGENT_VERSION_GLOBAL,
  Properties.Project.AGENT_VERSION_PROJECT,
  Properties.Project.IS_CONFIG_PRESENT,
  Properties.Project.LANGUAGE,
});

*/
