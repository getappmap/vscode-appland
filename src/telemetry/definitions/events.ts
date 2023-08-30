import Event from '../event';
import * as Properties from './properties';

/**
 * An event is a uniquely identified collection of telemetry data. Events of the same `eventName` will often contain the
 * same properties and metrics. This map binds properties and metrics together under a common event.
 */
export const DEBUG_EXCEPTION = new Event({
  name: 'debug/exception',
  properties: [Properties.DEBUG_EXCEPTION, Properties.DEBUG_ERROR_CODE, Properties.DEBUG_LOG],
});
