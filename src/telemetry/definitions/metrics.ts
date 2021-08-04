import TelemetryDataProvider from '../telemetryDataProvider';

export const APPMAP_JSON = new TelemetryDataProvider({
  id: 'appmap.json',
  async value({ metrics }: { metrics: Record<string, number> }) {
    return metrics;
  },
});
