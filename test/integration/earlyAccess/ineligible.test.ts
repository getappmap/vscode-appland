// @project project-early-access-eligible

import AppMapService from '../../../src/appMapService';
import { RuntimeAnalysisCtaServiceInstance } from '../../../src/services/runtimeAnalysisCtaService';
import { waitForExtension } from '../util';
import { waitForEligibility } from './util';

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
    if (serviceInstances.every((i) => i.eligible !== false)) {
      await waitForEligibility(serviceInstances, false);
    }
  });
});
