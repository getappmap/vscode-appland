import Event from '../event';
import * as Properties from './properties';
import * as Metrics from './metrics';

/**
 * An event is a uniquely identified collection of telemetry data. Events of the same `eventName` will often contain the
 * same properties and metrics. This map binds properties and metrics together under a common event.
 */
export const DEBUG_EXCEPTION = new Event({
  name: 'debug/exception',
  properties: [Properties.DEBUG_EXCEPTION, Properties.DEBUG_ERROR_CODE, Properties.DEBUG_LOG],
});

export const PROJECT_OPEN = new Event({
  name: 'project:open',
  properties: [
    Properties.AGENT_CONFIG_PRESENT,
    Properties.SCANNER_CONFIG_PRESENT,
    Properties.HAS_DEVCONTAINER,
    Properties.DEPENDENCIES,
    Properties.PROJECT_PATH,
    Properties.VERSION_CONTROL_REPOSITORY,
    Properties.PROXY_ENABLED,
    Properties.PROXY_SETTINGS,
  ],
  metrics: [Metrics.NUM_WORKSPACE_FOLDERS],
});

export const INSTALL_BUTTON_ERROR = new Event({
  name: 'install-button:error',
  properties: [Properties.DEBUG_EXCEPTION, Properties.DEFAULT_TERMINALS],
});
