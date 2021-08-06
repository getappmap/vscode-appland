import assert from 'assert';
import { suite, test, describe } from 'mocha';
import { buildAppMap } from '@appland/models';

import { getAppMapMetrics } from '../src/telemetry.mjs';
import appmapData from './data/appmap.json.mjs';

const appmap = buildAppMap(appmapData)
  .normalize()
  .build();

suite('Telemetry', () => {
  describe('getAppMapMetrics', () => {
    test('returns correct metrics when the AppMap is valid', () => {
      const metrics = getAppMapMetrics(appmap);
      assert.deepStrictEqual(metrics, {
        num_classes: 22,
        num_events: 496,
        num_functions: 21,
        num_http_client_events: 0,
        num_http_server_events: 4,
        num_labels: 4,
        num_labeled_events: 83,
        num_packages: 6,
        num_sql_events: 41,
      });
    });

    test('handles invalid input gracefully', () => {
      [{}, null, []].forEach((d) => {
        const metrics = getAppMapMetrics(d);
        assert.deepStrictEqual(metrics, {
          num_classes: 0,
          num_events: 0,
          num_functions: 0,
          num_http_client_events: 0,
          num_http_server_events: 0,
          num_labels: 0,
          num_labeled_events: 0,
          num_packages: 0,
          num_sql_events: 0,
        });
      });
    });
  });
});
