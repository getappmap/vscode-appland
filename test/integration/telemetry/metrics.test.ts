import { deepStrictEqual } from 'assert';
import { unsafeCast } from '../util';
import { Finding } from '@appland/scanner';
import { NUM_FINDINGS } from '../../../src/telemetry/definitions/metrics';

describe('Metrics', () => {
  describe('appmap.analysis', () => {
    it('counts findings', async () => {
      const findings = unsafeCast<ReadonlyArray<Finding>>([
        { impactDomain: 'Maintainability', hash_v2: '1' },
        { impactDomain: 'Maintainability', hash_v2: '1' },
        { impactDomain: 'Security', hash_v2: '2' },
      ]);
      const result = await NUM_FINDINGS.getValue({ findings });
      deepStrictEqual(result, {
        num_total_findings: 3,
        num_unique_findings: 2,
        num_maintainability: 2,
        num_unique_maintainability: 1,
        num_unique_security: 1,
        num_security: 1,
      });
    });
  });
});
