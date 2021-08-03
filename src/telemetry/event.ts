import TelemetryDataProvider from './telemetryDataProvider';

interface EventData<PropertyType, MetricType> {
  readonly name: string;
  properties?: PropertyType;
  metrics?: MetricType;
}

// Type inferencing does not work for interfaces, so we implement the EventData interface
// See https://github.com/Microsoft/TypeScript/wiki/FAQ#why-doesnt-type-inference-work-on-this-interface-interface-foot--
// for more information.
export default class Event<PropertyType, MetricType>
  implements EventData<PropertyType, MetricType> {
  readonly name: string;
  properties?: PropertyType;
  metrics?: MetricType;

  constructor({ name, properties, metrics }: EventData<PropertyType, MetricType>) {
    this.name = name;
    this.properties = properties;
    this.metrics = metrics;
  }
}
