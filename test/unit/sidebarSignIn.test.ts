import assert from 'assert';
import sinon from 'sinon';
import vscode from './mock/vscode';

import * as auth from '../../src/authentication';
import SignInManager from '../../src/services/signInManager';
import MockExtensionContext from '../mocks/mockExtensionContext';
import ExtensionState from '../../src/configuration/extensionState';

import { waitFor } from '../waitFor';

describe('Sidebar sign-in', () => {
  let sandbox: sinon.SinonSandbox;
  let stubbedExecuteCommand: sinon.SinonStub<[], void>;
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

  afterEach(() => {
    sandbox.restore();
  });

  it('is not shown for an existing user who is logged in and then logs out', async () => {
    getApiKeyStub.returns(Promise.resolve(fakeApiKey));
    sandbox.stub(extensionState, 'firstVersionInstalled').value(existingUserVersion);

    await SignInManager.register(extensionState);
    await expectShowSignIn(false);

    // user logs out
    getApiKeyStub.returns(Promise.resolve(noApiKey));
    await SignInManager.updateSignInState();
    await expectShowSignIn(false);
  });

  it('is not shown for a new user who is authenticated, but is shown when they log out', async () => {
    getApiKeyStub.returns(Promise.resolve(fakeApiKey));
    sandbox.stub(extensionState, 'firstVersionInstalled').value(newUserVersion);

    await SignInManager.register(extensionState);
    await expectShowSignIn(false);

    // user logs out
    getApiKeyStub.returns(Promise.resolve(noApiKey));
    await SignInManager.updateSignInState();
    await expectShowSignIn(true);
  });

  it('is not shown for an existing user who is not authenticated and then logs in', async () => {
    getApiKeyStub.returns(Promise.resolve(noApiKey));
    sandbox.stub(extensionState, 'firstVersionInstalled').value(existingUserVersion);

    await SignInManager.register(extensionState);
    await expectShowSignIn(false);

    // user logs in
    getApiKeyStub.returns(Promise.resolve(fakeApiKey));
    await SignInManager.updateSignInState();
    await expectShowSignIn(false);
  });

  it('is shown for a new user who is not authenticated, but is not shown once they log in', async () => {
    getApiKeyStub.returns(Promise.resolve(noApiKey));
    sandbox.stub(extensionState, 'firstVersionInstalled').value(newUserVersion);

    await SignInManager.register(extensionState);
    await expectShowSignIn(true);

    // user logs in
    getApiKeyStub.returns(Promise.resolve(fakeApiKey));
    await SignInManager.updateSignInState();
    await expectShowSignIn(false);
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
