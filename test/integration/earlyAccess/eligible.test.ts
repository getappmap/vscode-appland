// @project project-early-access-eligible

import assert from 'assert';
import AppMapService from '../../../src/appMapService';
import { touch } from '../../../src/lib/touch';
import { RuntimeAnalysisCtaServiceInstance } from '../../../src/services/runtimeAnalysisCtaService';
import * as path from 'path';
import { waitForExtension } from '../util';
import { waitForEligibility } from './util';

const workspaceFolder = path.join(
  __dirname,
  '../../../../test/fixtures/workspaces/project-early-access-eligible'
);

describe('Early access (eligible project)', () => {
  let extension: AppMapService;
  let serviceInstances: RuntimeAnalysisCtaServiceInstance[];

  beforeEach(async () => {
    extension = await waitForExtension();
    const { runtimeAnalysisCta } = extension;
    serviceInstances = extension.workspaceServices.getServiceInstances(
      runtimeAnalysisCta
    ) as RuntimeAnalysisCtaServiceInstance[];
  });

  it('has the expected flags', async () => {
    setInterval(() => {
      // Repeatedly touch an appmap to make sure the `Recorded AppMaps` flag is true
      touch(path.join(workspaceFolder, 'example.appmap.json'));
    }, 1000);

    if (!serviceInstances.every((i) => i.eligible === true)) {
      await waitForEligibility(serviceInstances, true);
    }

    const { extensionState } = extension;
    assert.strictEqual(extensionState.shouldViewBetaCta, true, 'the notification can appear');
  });
});
