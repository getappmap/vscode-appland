import { assert } from 'console';
import sinon from 'sinon';
import * as vscode from 'vscode';
import { AUTHN_PROVIDER_NAME } from '../../../src/authentication';
import AnalysisManager from '../../../src/services/analysisManager';
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

    it('indicates analysis is disabled if the findings feature flag is off', () => {
      vscode.workspace.getConfiguration('appMap').update('findingsEnabled', false);
      assert(AnalysisManager.isAnalysisEnabled === false);
    });

    it('indicates analysis is enabled if the findings feature flag is on', () => {
      vscode.workspace.getConfiguration('appMap').update('findingsEnabled', true);
      assert(AnalysisManager.isAnalysisEnabled);
    });

    it('findingsIndex is created when findings are enabled', () => {
      assert(AnalysisManager.findingsIndex === undefined);

      vscode.workspace.getConfiguration('appMap').update('findingsEnabled', true);
      assert(AnalysisManager.findingsIndex);

      vscode.workspace.getConfiguration('appMap').update('findingsEnabled', false);
      assert(AnalysisManager.findingsIndex === undefined);
    });

    it('restores diagnostics as analysis is toggled', async () => {
      await waitFor('diagnostics were found unexpectedly', hasNoDiagnostics);

      vscode.workspace.getConfiguration('appMap').update('findingsEnabled', true);
      await waitFor('diagnostics were not restored', hasDiagnostics);

      vscode.workspace.getConfiguration('appMap').update('findingsEnabled', false);
      await waitFor('diagnostics were not removed', hasNoDiagnostics);
    });

    it('initializes and removes the FindingWatcher service as analysis is toggled', async () => {
      const { workspaceServices } = await waitForExtension();
      assert(workspaceServices.getService(FindingWatcher) === undefined);

      vscode.workspace.getConfiguration('appMap').update('findingsEnabled', true);
      assert(workspaceServices.getService(FindingWatcher));

      vscode.workspace.getConfiguration('appMap').update('findingsEnabled', false);
      assert(workspaceServices.getService(FindingWatcher) === undefined);
    });
  });

  context('with findings feature flag enabled', () => {
    beforeEach(() => {
      vscode.workspace.getConfiguration('appMap').update('findingsEnabled', true);
    });

    it('indicates analysis is enabled if the user is authenticated', () => {
      sinon
        .stub(vscode.authentication, 'getSession')
        .withArgs(AUTHN_PROVIDER_NAME, ['default'], sinon.match.any)
        .resolves({} as vscode.AuthenticationSession);

      assert(AnalysisManager.isAnalysisEnabled);

      sinon.restore();
    });

    it('indicates analysis is disabled if the user is not authenticated', () => {
      assert(AnalysisManager.isAnalysisEnabled);
    });
  });
});
