import '../mock/vscode';

import { expect } from 'chai';
import Sinon from 'sinon';
import * as vscode from 'vscode';

import {
  bundledCustomerId,
  clearCustomerId,
  getCustomerId,
  getCustomerIdState,
  isEntitled,
  onDidChangeEntitlement,
  registerCustomerIdOverrideWarning,
  seedCustomerId,
  setCustomerId,
} from '../../../src/configuration/customerId';
import MockExtensionContext from '../../mocks/mockExtensionContext';
import { Configuration, resetConfigurations } from '../mock/vscode/workspace';

const STATE_KEY = 'appmap.customerId';

describe('customerId', () => {
  let context: MockExtensionContext;

  // The bundled default that build/bundleConfig.ps1 synthesizes into a repackaged VSIX.
  function bundleDefault(value: string | undefined) {
    (vscode.workspace.getConfiguration('appMap') as Configuration).setDefault('customerId', value);
  }

  beforeEach(() => {
    context = new MockExtensionContext();
  });

  afterEach(() => {
    context.dispose();
    resetConfigurations();
    Sinon.restore();
  });

  describe('bundledCustomerId()', () => {
    it('returns the setting default on a bundled build', () => {
      bundleDefault('acme-corp');
      expect(bundledCustomerId()).to.equal('acme-corp');
    });

    it('is undefined on a vanilla build', () => {
      expect(bundledCustomerId()).to.be.undefined;
    });

    it('treats a blank default as absent', () => {
      bundleDefault('   ');
      expect(bundledCustomerId()).to.be.undefined;
    });
  });

  describe('seedCustomerId()', () => {
    it('seeds from the bundled default when globalState is empty', async () => {
      bundleDefault('acme-corp');
      await seedCustomerId(context);
      expect(getCustomerIdState(context)).to.deep.equal({ value: 'acme-corp', source: 'bundled' });
    });

    it('trims the seeded value', async () => {
      bundleDefault('  acme-corp  ');
      await seedCustomerId(context);
      expect(getCustomerId(context)).to.equal('acme-corp');
    });

    it('does not seed from a blank default', async () => {
      bundleDefault('   ');
      await seedCustomerId(context);
      expect(getCustomerId(context)).to.be.undefined;
    });

    it('does nothing on a vanilla build with empty globalState', async () => {
      await seedCustomerId(context);
      expect(context.globalState.get(STATE_KEY)).to.be.undefined;
    });

    it('re-seeds when the bundled default changes across a VSIX upgrade', async () => {
      await context.globalState.update(STATE_KEY, { value: 'old-corp', source: 'bundled' });
      bundleDefault('new-corp');

      await seedCustomerId(context);

      expect(getCustomerIdState(context)).to.deep.equal({ value: 'new-corp', source: 'bundled' });
    });

    it('leaves an unchanged bundled value alone', async () => {
      bundleDefault('acme-corp');
      await seedCustomerId(context);
      await seedCustomerId(context);
      expect(getCustomerIdState(context)).to.deep.equal({ value: 'acme-corp', source: 'bundled' });
    });

    it('clears a bundled value when a vanilla build is installed over a bundled one', async () => {
      await context.globalState.update(STATE_KEY, { value: 'acme-corp', source: 'bundled' });

      await seedCustomerId(context);

      expect(getCustomerId(context)).to.be.undefined;
      expect(context.globalState.get(STATE_KEY)).to.be.undefined;
    });

    it('does not clobber an orgConfig value with the bundled default', async () => {
      await context.globalState.update(STATE_KEY, { value: 'from-url', source: 'orgConfig' });
      bundleDefault('acme-corp');

      await seedCustomerId(context);

      expect(getCustomerIdState(context)).to.deep.equal({ value: 'from-url', source: 'orgConfig' });
    });

    it('keeps an orgConfig value on a vanilla build', async () => {
      await context.globalState.update(STATE_KEY, { value: 'from-url', source: 'orgConfig' });

      await seedCustomerId(context);

      expect(getCustomerIdState(context)).to.deep.equal({ value: 'from-url', source: 'orgConfig' });
    });

    it('self-heals a corrupt entry by re-seeding', async () => {
      await context.globalState.update(STATE_KEY, { value: 42, source: 'nonsense' });
      bundleDefault('acme-corp');

      await seedCustomerId(context);

      expect(getCustomerIdState(context)).to.deep.equal({ value: 'acme-corp', source: 'bundled' });
    });

    it('discards a corrupt entry when there is no bundled default', async () => {
      await context.globalState.update(STATE_KEY, 'not-an-object');

      await seedCustomerId(context);

      expect(context.globalState.get(STATE_KEY)).to.be.undefined;
    });
  });

  describe('getCustomerId()', () => {
    it('ignores a globalValue override of the setting', async () => {
      await vscode.workspace
        .getConfiguration('appMap')
        .update('customerId', 'hand-written', vscode.ConfigurationTarget.Global);

      await seedCustomerId(context);

      expect(getCustomerId(context)).to.be.undefined;
      expect(isEntitled(context)).to.be.false;
    });

    it('ignores a settings override even on a bundled build', async () => {
      bundleDefault('acme-corp');
      await vscode.workspace.getConfiguration('appMap').update('customerId', 'hand-written');

      await seedCustomerId(context);

      expect(getCustomerId(context)).to.equal('acme-corp');
    });

    it('reports entitlement once a value is present', async () => {
      expect(isEntitled(context)).to.be.false;
      await setCustomerId(context, 'from-url', 'orgConfig');
      expect(isEntitled(context)).to.be.true;
    });
  });

  describe('setCustomerId()', () => {
    it('records the value and its provenance', async () => {
      const result = await setCustomerId(context, 'from-url', 'orgConfig');
      expect(result).to.equal('from-url');
      expect(getCustomerIdState(context)).to.deep.equal({ value: 'from-url', source: 'orgConfig' });
    });

    it('trims the value', async () => {
      await setCustomerId(context, '  from-url\n', 'orgConfig');
      expect(getCustomerId(context)).to.equal('from-url');
    });

    it('overrides a bundled value', async () => {
      bundleDefault('acme-corp');
      await seedCustomerId(context);

      await setCustomerId(context, 'from-url', 'orgConfig');

      expect(getCustomerIdState(context)).to.deep.equal({ value: 'from-url', source: 'orgConfig' });
    });

    it('treats a blank value as a clear', async () => {
      await setCustomerId(context, 'from-url', 'orgConfig');

      const result = await setCustomerId(context, '  ', 'orgConfig');

      expect(result).to.be.undefined;
      expect(getCustomerId(context)).to.be.undefined;
    });

    it('reconverges on the bundled default when cleared by a blank value', async () => {
      bundleDefault('acme-corp');
      await setCustomerId(context, 'from-url', 'orgConfig');

      const result = await setCustomerId(context, '', 'orgConfig');

      expect(result).to.equal('acme-corp');
      expect(getCustomerIdState(context)).to.deep.equal({ value: 'acme-corp', source: 'bundled' });
    });
  });

  // globalState.update() fires nothing of its own, so entitlement gained or lost mid-session
  // has to be announced or every consumer keeps stale state until reload.
  describe('onDidChangeEntitlement', () => {
    let fired: (string | undefined)[];
    let subscription: vscode.Disposable;

    beforeEach(() => {
      fired = [];
      subscription = onDidChangeEntitlement((value) => fired.push(value));
    });

    afterEach(() => subscription.dispose());

    it('fires when entitlement is gained', async () => {
      await setCustomerId(context, 'acme-corp', 'orgConfig');
      expect(fired).to.deep.equal(['acme-corp']);
    });

    it('fires when the customer ID changes', async () => {
      await setCustomerId(context, 'acme-corp', 'orgConfig');
      await setCustomerId(context, 'other-corp', 'orgConfig');
      expect(fired).to.deep.equal(['acme-corp', 'other-corp']);
    });

    it('fires when entitlement is lost', async () => {
      await setCustomerId(context, 'acme-corp', 'orgConfig');
      fired.length = 0;

      await clearCustomerId(context);

      expect(fired).to.deep.equal([undefined]);
    });

    it('does not fire when the same value is written again', async () => {
      await setCustomerId(context, 'acme-corp', 'orgConfig');
      fired.length = 0;

      await setCustomerId(context, 'acme-corp', 'orgConfig');

      expect(fired).to.be.empty;
    });

    it('does not fire when only the provenance changes', async () => {
      await setCustomerId(context, 'acme-corp', 'orgConfig');
      fired.length = 0;

      await setCustomerId(context, 'acme-corp', 'bundled');

      expect(fired).to.be.empty;
      expect(getCustomerIdState(context)?.source).to.equal('bundled');
    });

    // Otherwise the clear command bounces the RPC server to announce a transition that
    // did not happen.
    it('does not fire when clearing reseeds a bundled build to the same ID', async () => {
      bundleDefault('acme-corp');
      await seedCustomerId(context);
      fired.length = 0;

      await clearCustomerId(context);

      expect(fired).to.be.empty;
      expect(getCustomerId(context)).to.equal('acme-corp');
    });

    it('fires when clearing an orgConfig value reveals a different bundled default', async () => {
      bundleDefault('acme-corp');
      await setCustomerId(context, 'other-corp', 'orgConfig');
      fired.length = 0;

      await clearCustomerId(context);

      expect(fired).to.deep.equal(['acme-corp']);
    });

    // Activation-only, and always ahead of any subscriber.
    it('does not fire from seedCustomerId', async () => {
      bundleDefault('acme-corp');

      await seedCustomerId(context);

      expect(fired).to.be.empty;
    });

    it('fires once when a blank value collapses to a clear', async () => {
      await setCustomerId(context, 'acme-corp', 'orgConfig');
      fired.length = 0;

      await setCustomerId(context, '   ', 'orgConfig');

      expect(fired).to.deep.equal([undefined]);
    });
  });

  // A hand-written appMap.customerId is inert, since only the setting's default is read.
  // On a bundled build that is worth saying out loud; in a public build a notification
  // explaining that the setting does nothing would advertise the feature to the one user
  // poking at it.
  describe('registerCustomerIdOverrideWarning()', () => {
    let fireConfigChange: (section: string) => unknown;
    let showWarningMessage: Sinon.SinonStub;
    let subscription: vscode.Disposable | undefined;

    beforeEach(() => {
      let listener: ((e: vscode.ConfigurationChangeEvent) => unknown) | undefined;
      Sinon.stub(vscode.workspace, 'onDidChangeConfiguration').callsFake((cb) => {
        listener = cb;
        return { dispose: () => undefined };
      });
      fireConfigChange = (section: string) =>
        listener?.({ affectsConfiguration: (s: string) => s === section });
      showWarningMessage = Sinon.stub(vscode.window, 'showWarningMessage').resolves(undefined);
      subscription = undefined;
    });

    afterEach(() => subscription?.dispose());

    // The check at registration time is fire-and-forget, so let it settle.
    async function register() {
      subscription = registerCustomerIdOverrideWarning();
      await new Promise((resolve) => setImmediate(resolve));
    }

    // An override set before the window reloaded is just as inert, and just as confusing.
    it('warns about an override that is already present at registration', async () => {
      bundleDefault('acme-corp');
      await vscode.workspace.getConfiguration('appMap').update('customerId', 'hand-written');

      await register();

      expect(showWarningMessage.calledOnce).to.be.true;
    });

    it('stays silent at registration when there is no override', async () => {
      bundleDefault('acme-corp');

      await register();

      expect(showWarningMessage.called).to.be.false;
    });

    it('does not warn twice when an override present at registration is then edited', async () => {
      bundleDefault('acme-corp');
      await vscode.workspace.getConfiguration('appMap').update('customerId', 'hand-written');

      await register();
      await fireConfigChange('appMap.customerId');

      expect(showWarningMessage.calledOnce).to.be.true;
    });

    it('stays silent in a public build, where the key is unregistered', async () => {
      await vscode.workspace.getConfiguration('appMap').update('customerId', 'hand-written');
      await register();

      await fireConfigChange('appMap.customerId');

      expect(showWarningMessage.called).to.be.false;
    });

    it('stays silent on a bundled build with no override', async () => {
      bundleDefault('acme-corp');
      await register();

      await fireConfigChange('appMap.customerId');

      expect(showWarningMessage.called).to.be.false;
    });

    it('warns when a registered key is overridden mid-session', async () => {
      bundleDefault('acme-corp');
      await register();
      await vscode.workspace.getConfiguration('appMap').update('customerId', 'hand-written');

      await fireConfigChange('appMap.customerId');

      expect(showWarningMessage.calledOnce).to.be.true;
      expect(String(showWarningMessage.firstCall.args[0])).to.include('appMap.customerId');
    });

    it('ignores changes to other settings', async () => {
      bundleDefault('acme-corp');
      await register();
      await vscode.workspace.getConfiguration('appMap').update('customerId', 'hand-written');

      await fireConfigChange('appMap.configurationUrl');

      expect(showWarningMessage.called).to.be.false;
    });

    // Editing settings.json fires several change events in a row.
    it('warns at most once per session', async () => {
      bundleDefault('acme-corp');
      await register();
      await vscode.workspace.getConfiguration('appMap').update('customerId', 'hand-written');

      await fireConfigChange('appMap.customerId');
      await fireConfigChange('appMap.customerId');
      await fireConfigChange('appMap.customerId');

      expect(showWarningMessage.calledOnce).to.be.true;
    });

    it('removes the setting from every scope that defines it when asked', async () => {
      const update = Sinon.stub().resolves();
      Sinon.stub(vscode.workspace, 'getConfiguration').returns({
        inspect: () => ({
          key: 'appMap.customerId',
          defaultValue: 'acme-corp',
          globalValue: 'hand-written',
          workspaceValue: 'also-hand-written',
        }),
        update,
      } as unknown as vscode.WorkspaceConfiguration);
      showWarningMessage.resolves('Remove setting');
      await register();

      await fireConfigChange('appMap.customerId');

      expect(update.callCount).to.equal(2);
      expect(update.calledWith('customerId', undefined, vscode.ConfigurationTarget.Global)).to.be
        .true;
      expect(update.calledWith('customerId', undefined, vscode.ConfigurationTarget.Workspace)).to.be
        .true;
    });

    it('leaves the setting alone when the warning is dismissed', async () => {
      bundleDefault('acme-corp');
      await vscode.workspace.getConfiguration('appMap').update('customerId', 'hand-written');
      await register();

      await fireConfigChange('appMap.customerId');

      expect(vscode.workspace.getConfiguration('appMap').get('customerId')).to.equal(
        'hand-written'
      );
    });
  });

  describe('clearCustomerId()', () => {
    it('clears fully on a vanilla build', async () => {
      await setCustomerId(context, 'from-url', 'orgConfig');

      const result = await clearCustomerId(context);

      expect(result).to.be.undefined;
      expect(getCustomerId(context)).to.be.undefined;
    });

    it('re-seeds synchronously on a bundled build', async () => {
      bundleDefault('acme-corp');
      await setCustomerId(context, 'from-url', 'orgConfig');

      const result = await clearCustomerId(context);

      expect(result).to.equal('acme-corp');
      expect(getCustomerIdState(context)).to.deep.equal({ value: 'acme-corp', source: 'bundled' });
    });
  });
});
