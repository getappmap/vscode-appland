// @project project-early-access-eligible

import AppMapService from '../../../src/appMapService';
import { touch } from '../../../src/lib/touch';
import * as path from 'path';
import { repeatUntil, waitForExtension } from '../util';

const workspaceFolder = path.join(
  __dirname,
  '../../../../test/fixtures/workspaces/project-early-access-eligible'
);

describe('Early access CTA on an eligible project', () => {
  let extension: AppMapService;

  beforeEach(async () => {
    extension = await waitForExtension();
  });

  it('has the expected flags', async () => {
    let isEligible = false;
    extension.runtimeAnalysisCta.onCheckEligibility((eligible) => {
      if (eligible && !isEligible) isEligible = eligible;
    });

    repeatUntil(
      () => touch(path.join(workspaceFolder, 'example.appmap.json')),
      'Beta CTA notification should be shown',
      () => isEligible
    );
  });
});
