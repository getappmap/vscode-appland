import { FindingWatcher } from '../../../src/services/findingWatcher';
import {
  hasNoDiagnostics,
  withAuthenticatedUser,
  waitFor,
  hasDiagnostics,
  waitForExtension,
} from '../util';

describe('AnalysisManager', () => {
  context('with authenticated user', () => {
    withAuthenticatedUser();

    it('analysis is enabled, finding watcher is initialized, finding index is created, has diagnostics', async () => {
      const { workspaceServices, analysisManager } = await waitForExtension();

      await waitFor('analysis is disabled', () => analysisManager.isAnalysisEnabled);
      await waitFor(
        'finding watcher is not present',
        () => !!workspaceServices.getService(FindingWatcher)
      );
      await waitFor('findings index is not present', () => !!analysisManager.findingsIndex);
      await waitFor('diagnostics are not present', hasDiagnostics);
    });
  });

  context('without authenticated user', () => {
    it('analysis is disabled, finding watcher is not initialized, finding index is not created, has no diagnostics', async () => {
      const { workspaceServices, analysisManager } = await waitForExtension();

      await waitFor('analysis is enabled', () => !analysisManager.isAnalysisEnabled);
      await waitFor(
        'finding watcher is present',
        () => !workspaceServices.getService(FindingWatcher)
      );
      await waitFor('findings index is present', () => !analysisManager.findingsIndex);
      await waitFor('diagnostics are present', hasNoDiagnostics);
    });
  });
});
