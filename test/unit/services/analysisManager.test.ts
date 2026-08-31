import '../mock/vscode';

import { expect } from 'chai';
import Sinon from 'sinon';

import * as auth from '../../../src/authentication';
import AnalysisManager, { AnalysisToggleEvent } from '../../../src/services/analysisManager';
import Environment from '../../../src/configuration/environment';
import { clearCustomerId, setCustomerId } from '../../../src/configuration/customerId';
import MockExtensionContext from '../../mocks/mockExtensionContext';
import { waitFor } from '../../waitFor';

describe('AnalysisManager', () => {
  let context: MockExtensionContext;
  let getApiKey: Sinon.SinonStub;

  beforeEach(async () => {
    context = new MockExtensionContext();
    // Otherwise this short-circuits to true before entitlement is ever consulted.
    Sinon.stub(Environment, 'isSystemTest').value(false);
    getApiKey = Sinon.stub(auth, 'getApiKey').resolves(undefined);
    await AnalysisManager.register(context);
  });

  afterEach(async () => {
    context.dispose();
    await clearCustomerId(context);
    Sinon.restore();
  });

  describe('isUserAuthenticated', () => {
    it('is false without a session and without a customer ID', async () => {
      expect(await AnalysisManager.isUserAuthenticated()).to.be.false;
    });

    it('is true with a session', async () => {
      getApiKey.resolves('fake api key');
      expect(await AnalysisManager.isUserAuthenticated()).to.be.true;
    });

    it('is true with a customer ID and no session', async () => {
      await setCustomerId(context, 'acme-corp', 'orgConfig');
      // register() already resolved the state once, while still unentitled.
      getApiKey.resetHistory();

      expect(await AnalysisManager.isUserAuthenticated()).to.be.true;
      expect(getApiKey.notCalled).to.be.true;
    });

    it('is false again once entitlement is cleared', async () => {
      await setCustomerId(context, 'acme-corp', 'orgConfig');
      await clearCustomerId(context);
      expect(await AnalysisManager.isUserAuthenticated()).to.be.false;
    });
  });

  describe('when entitlement changes mid-session', () => {
    let toggles: AnalysisToggleEvent[];
    let subscription: { dispose(): unknown };

    beforeEach(() => {
      // Enabling analysis builds a findings index, diagnostics provider and file-system
      // watcher, none of which the vscode mock supports; the integration suite covers them.
      // What matters here is that the entitlement event drives the state transition at all.
      const internals = AnalysisManager as unknown as {
        onAnalysisEnabled(): void;
        onAnalysisDisabled(): void;
      };
      Sinon.stub(internals, 'onAnalysisEnabled');
      Sinon.stub(internals, 'onAnalysisDisabled');

      toggles = [];
      subscription = AnalysisManager.onAnalysisToggled((e) => toggles.push(e));
    });

    afterEach(() => subscription.dispose());

    it('enables analysis when a customer ID arrives', async () => {
      expect(AnalysisManager.isAnalysisEnabled).to.be.false;

      await setCustomerId(context, 'acme-corp', 'orgConfig');

      await waitFor('analysis to be enabled', () => AnalysisManager.isAnalysisEnabled);
      expect(toggles).to.deep.equal([{ enabled: true, userAuthenticated: true }]);
    });

    it('disables analysis when entitlement is withdrawn', async () => {
      await setCustomerId(context, 'acme-corp', 'orgConfig');
      await waitFor('analysis to be enabled', () => AnalysisManager.isAnalysisEnabled);
      toggles.length = 0;

      await clearCustomerId(context);

      await waitFor('analysis to be disabled', () => !AnalysisManager.isAnalysisEnabled);
      expect(toggles).to.deep.equal([{ enabled: false, userAuthenticated: false }]);
    });
  });
});
