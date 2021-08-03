import Event from '../event';
import Properties from './properties';
/**
 * An event is a uniquely identified collection of telemetry data. Events of the same `eventName` will often contain the
 * same properties and metrics. This map binds properties and metrics together under a common event.
 */
export const DEBUG_EXCEPTION = new Event({
  name: 'debug/exception',
  properties: [Properties.Debug.EXCEPTION],
});

export const PROJECT_OPEN = new Event({
  name: 'project:open',
  properties: [
    Properties.Project.AGENT_VERSION,
    Properties.Project.IS_CONFIG_PRESENT,
    Properties.Project.LANGUAGE,
    Properties.Project.LANGUAGE_DISTRIBUTION,
  ],
  // metrics: [Metrics.Project.EXAMPLE],
});

export const PROJECT_CLIENT_AGENT_ADD = new Event({
  name: 'project/client_agent:add',
  properties: [Properties.Project.AGENT_VERSION, Properties.Project.LANGUAGE],
});

export const PROJECT_CLIENT_AGENT_REMOVE = new Event({
  name: 'project/client_agent:remove',
  properties: [],
});

export const PROJECT_CONFIG_WRITE = new Event({
  name: 'project/config:write',
  properties: [],
});

export const MILESTONE_CHANGE_STATE = new Event({
  name: 'milestone:change_state',
  properties: [Properties.Milestones.ID, Properties.Milestones.STATE],
});

export const APPMAP_OPEN = new Event({
  name: 'appmap:open',
  properties: [
    Properties.File.PATH,
    Properties.File.SHA_256,
    Properties.File.METADATA,
    Properties.Project.LANGUAGE,
  ],
});
