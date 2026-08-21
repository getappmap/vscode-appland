import assert from 'assert';
import sinon from 'sinon';
import vscode from './mock/vscode';

import * as auth from '../../src/authentication';
import SignInManager from '../../src/services/signInManager';
import MockExtensionContext from '../mocks/mockExtensionContext';
import ExtensionState from '../../src/configuration/extensionState';
import { clearCustomerId, setCustomerId } from '../../src/configuration/customerId';

import { waitFor } from '../waitFor';

describe('Sidebar sign-in', () => {
  let sandbox: sinon.SinonSandbox;
  let stubbedExecuteCommand: sinon.SinonStub;
  let getApiKeyStub: sinon.SinonStub<
    [createIfNone: boolean, ssoTarget?: string],
    Promise<string | undefined>
  >;
  const context = new MockExtensionContext();
  const extensionState = new ExtensionState(context);
  const existingUserVersion = '0.66.2';
  const newUserVersion = '0.66.3';
  const fakeApiKey = 'fake api key';
  const noApiKey = undefined;

  beforeEach(() => {
    sandbox = sinon.createSandbox();
    stubbedExecuteCommand = sandbox.stub(vscode.commands, 'executeCommand');
    getApiKeyStub = sandbox.stub(auth, 'getApiKey');
  });

  afterEach(async () => {
    // register() subscribes to entitlement changes; without this the listeners accumulate
    // across cases, since SignInManager keeps its state statically and the context is shared.
    context.subscriptions.forEach((subscription) => subscription.dispose());
    context.subscriptions.length = 0;
    sandbox.restore();
    await clearCustomerId(context);
  });

  it('is not shown for an existing user who is logged in and then logs out', async () => {
    getApiKeyStub.returns(Promise.resolve(fakeApiKey));
    sandbox.stub(extensionState, 'firstVersionInstalled').value(existingUserVersion);

    await SignInManager.register(extensionState, context);
    await expectShowSignIn(false);

    // user logs out
    getApiKeyStub.returns(Promise.resolve(noApiKey));
    await SignInManager.updateSignInState();
    await expectShowSignIn(false);
  });

  it('is not shown for a new user who is authenticated, but is shown when they log out', async () => {
    getApiKeyStub.returns(Promise.resolve(fakeApiKey));
    sandbox.stub(extensionState, 'firstVersionInstalled').value(newUserVersion);

    await SignInManager.register(extensionState, context);
    await expectShowSignIn(false);

    // user logs out
    getApiKeyStub.returns(Promise.resolve(noApiKey));
    await SignInManager.updateSignInState();
    await expectShowSignIn(true);
  });

  it('is not shown for an existing user who is not authenticated and then logs in', async () => {
    getApiKeyStub.returns(Promise.resolve(noApiKey));
    sandbox.stub(extensionState, 'firstVersionInstalled').value(existingUserVersion);

    await SignInManager.register(extensionState, context);
    await expectShowSignIn(false);

    // user logs in
    getApiKeyStub.returns(Promise.resolve(fakeApiKey));
    await SignInManager.updateSignInState();
    await expectShowSignIn(false);
  });

  it('is shown for a new user who is not authenticated, but is not shown once they log in', async () => {
    getApiKeyStub.returns(Promise.resolve(noApiKey));
    sandbox.stub(extensionState, 'firstVersionInstalled').value(newUserVersion);

    await SignInManager.register(extensionState, context);
    await expectShowSignIn(true);

    // user logs in
    getApiKeyStub.returns(Promise.resolve(fakeApiKey));
    await SignInManager.updateSignInState();
    await expectShowSignIn(false);
  });

  it('is not shown for a new user with no API key when a customer ID entitles the installation', async () => {
    getApiKeyStub.returns(Promise.resolve(noApiKey));
    sandbox.stub(extensionState, 'firstVersionInstalled').value(newUserVersion);
    await setCustomerId(context, 'acme-corp', 'orgConfig');

    await SignInManager.register(extensionState, context);

    await expectShowSignIn(false);
  });

  it('does not consult the API key at all when entitled', async () => {
    getApiKeyStub.returns(Promise.resolve(noApiKey));
    sandbox.stub(extensionState, 'firstVersionInstalled').value(newUserVersion);
    await setCustomerId(context, 'acme-corp', 'orgConfig');

    await SignInManager.register(extensionState, context);
    await expectShowSignIn(false);

    assert(getApiKeyStub.notCalled);
  });

  it('is shown again once entitlement is cleared', async () => {
    getApiKeyStub.returns(Promise.resolve(noApiKey));
    sandbox.stub(extensionState, 'firstVersionInstalled').value(newUserVersion);
    await setCustomerId(context, 'acme-corp', 'orgConfig');

    await SignInManager.register(extensionState, context);
    await expectShowSignIn(false);

    await clearCustomerId(context);
    await SignInManager.updateSignInState();

    await expectShowSignIn(true);
  });

  // globalState fires no change event of its own, so an entitlement that arrives mid-session
  // has to be announced or the sign-in view stays up until the window reloads.
  it('hides itself when a customer ID arrives mid-session', async () => {
    getApiKeyStub.returns(Promise.resolve(noApiKey));
    sandbox.stub(extensionState, 'firstVersionInstalled').value(newUserVersion);

    await SignInManager.register(extensionState, context);
    await expectShowSignIn(true);

    await setCustomerId(context, 'acme-corp', 'orgConfig');

    await expectShowSignIn(false);
  });

  it('reappears when entitlement is withdrawn mid-session', async () => {
    getApiKeyStub.returns(Promise.resolve(noApiKey));
    sandbox.stub(extensionState, 'firstVersionInstalled').value(newUserVersion);
    await setCustomerId(context, 'acme-corp', 'orgConfig');

    await SignInManager.register(extensionState, context);
    await expectShowSignIn(false);

    await clearCustomerId(context);

    await expectShowSignIn(true);
  });

  async function expectShowSignIn(value: boolean): Promise<void> {
    await waitFor(`Expected 'appMap.showSignIn' context value to be ${value}`, () => {
      const call = stubbedExecuteCommand.getCalls().at(-1);
      if (call) {
        assert.deepStrictEqual(call.args, ['setContext', 'appMap.showSignIn', value]);
        assert(SignInManager.shouldShowSignIn() === value);
        return true;
      }
      return false;
    });
  }
});
