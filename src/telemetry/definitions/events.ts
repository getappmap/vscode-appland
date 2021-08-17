import Event from '../event';
import * as Properties from './properties';
import * as Metrics from './metrics';

/**
 * An event is a uniquely identified collection of telemetry data. Events of the same `eventName` will often contain the
 * same properties and metrics. This map binds properties and metrics together under a common event.
 */
export const DEBUG_EXCEPTION = new Event({
  name: 'debug/exception',
  properties: [Properties.DEBUG_EXCEPTION],
});

export const PROJECT_OPEN = new Event({
  name: 'project:open',
  properties: [
    Properties.PROJECT_AGENT_VERSION,
    Properties.PROJECT_IS_CONFIG_PRESENT,
    Properties.PROJECT_LANGUAGE,
    Properties.PROJECT_LANGUAGE_DISTRIBUTION,
  ],
  // metrics: [Metrics.PROJECT_EXAMPLE],
});

export const PROJECT_CLIENT_AGENT_ADD = new Event({
  name: 'project/client_agent:add',
  properties: [Properties.PROJECT_AGENT_VERSION, Properties.PROJECT_LANGUAGE],
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
  properties: [Properties.MILESTONE_ID, Properties.MILESTONE_STATE],
});

export const APPMAP_OPEN = new Event({
  name: 'appmap:open',
  properties: [
    Properties.FILE_PATH,
    Properties.FILE_SHA_256,
    Properties.FILE_METADATA,
    Properties.PROJECT_LANGUAGE,
  ],
  metrics: [Metrics.APPMAP_JSON],
});

export const APPMAP_UPLOAD = new Event({
  name: 'appmap:upload',
  properties: [
    Properties.FILE_PATH,
    Properties.FILE_SHA_256,
    Properties.FILE_SIZE,
    Properties.FILE_METADATA,
    Properties.PROJECT_LANGUAGE,
  ],
  metrics: [Metrics.APPMAP_JSON],
});

export const RECORDING_START = new Event({
  name: 'remote_recording:start',
  properties: [
    Properties.PROJECT_LANGUAGE,
    Properties.RECORDING_ENDPOINT_URL,
    Properties.RECORDING_RETURN_CODE,
  ],
});

export const RECORDING_STOP = new Event({
  name: 'remote_recording:stop',
  properties: [
    Properties.PROJECT_LANGUAGE,
    Properties.RECORDING_ENDPOINT_URL,
    Properties.RECORDING_RETURN_CODE,
  ],
});

export const RECORDING_STATUS = new Event({
  name: 'remote_recording:status',
  properties: [
    Properties.PROJECT_LANGUAGE,
    Properties.RECORDING_ENDPOINT_URL,
    Properties.RECORDING_RETURN_CODE,
  ],
});

export const TELEMETRY_ENABLED = new Event({
  name: 'telemetry',
  properties: [Properties.IS_TELEMETRY_ENABLED],
});
