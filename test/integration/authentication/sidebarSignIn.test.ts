import * as vscode from 'vscode';
import assert from 'assert';
import sinon from 'sinon';
import * as auth from '../../../src/authentication';
import SignInManager from '../../../src/services/signInManager';
import MockExtensionContext from '../../mocks/mockExtensionContext';
import ExtensionState from '../../../src/configuration/extensionState';

describe('Sidebar sign-in', () => {
  let sandbox: sinon.SinonSandbox;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let stubbedExecuteCommand: sinon.SinonStub<[command: string, ...rest: any[]], Thenable<unknown>>;
  const context = new MockExtensionContext();
  const extensionState = new ExtensionState(context);
  const existingUserVersion = '0.66.2';
  const newUserVersion = '0.66.3';
  const fakeApiKey = 'fake api key';
  const noApiKey = undefined;

  beforeEach(() => {
    sandbox = sinon.createSandbox();
    stubbedExecuteCommand = sandbox.stub(vscode.commands, 'executeCommand');
  });

  afterEach(() => {
    sandbox.restore();
  });

  it('is not shown for an existing user who is logged in and then logs out', async () => {
    const getApiKeyStub = sandbox.stub(auth, 'getApiKey');
    getApiKeyStub.returns(Promise.resolve(fakeApiKey));
    sandbox.stub(extensionState, 'firstVersionInstalled').value(existingUserVersion);

    await SignInManager.register(extensionState);
    assert(!SignInManager.shouldShowSignIn());

    let expectedArgs = ['setContext', 'appMap.showSignIn', false];
    assert.deepStrictEqual(stubbedExecuteCommand.getCall(0).args, expectedArgs);

    // user logs out
    getApiKeyStub.returns(Promise.resolve(noApiKey));
    await SignInManager.updateSignInState();
    assert(!SignInManager.shouldShowSignIn());

    expectedArgs = ['setContext', 'appMap.showSignIn', false];
    assert.deepStrictEqual(stubbedExecuteCommand.getCall(2).args, expectedArgs);
  });

  it('is not shown for a new user who is authenticated, but is shown when they log out', async () => {
    const getApiKeyStub = sandbox.stub(auth, 'getApiKey');
    getApiKeyStub.returns(Promise.resolve(fakeApiKey));
    sandbox.stub(extensionState, 'firstVersionInstalled').value(newUserVersion);

    await SignInManager.register(extensionState);
    assert(!SignInManager.shouldShowSignIn());

    let expectedArgs = ['setContext', 'appMap.showSignIn', false];
    assert.deepStrictEqual(stubbedExecuteCommand.getCall(0).args, expectedArgs);

    // user logs out
    getApiKeyStub.returns(Promise.resolve(noApiKey));
    await SignInManager.updateSignInState();
    assert(SignInManager.shouldShowSignIn());

    expectedArgs = ['setContext', 'appMap.showSignIn', true];
    assert.deepStrictEqual(stubbedExecuteCommand.getCall(2).args, expectedArgs);
  });

  it('is not shown for an existing user who is not authenticated and then logs in', async () => {
    const getApiKeyStub = sandbox.stub(auth, 'getApiKey');
    getApiKeyStub.returns(Promise.resolve(noApiKey));
    sandbox.stub(extensionState, 'firstVersionInstalled').value(existingUserVersion);

    await SignInManager.register(extensionState);
    assert(!SignInManager.shouldShowSignIn());

    let expectedArgs = ['setContext', 'appMap.showSignIn', false];
    assert.deepStrictEqual(stubbedExecuteCommand.getCall(0).args, expectedArgs);

    // user logs in
    getApiKeyStub.returns(Promise.resolve(fakeApiKey));
    await SignInManager.updateSignInState();
    assert(!SignInManager.shouldShowSignIn());

    expectedArgs = ['setContext', 'appMap.showSignIn', false];
    assert.deepStrictEqual(stubbedExecuteCommand.getCall(2).args, expectedArgs);
  });

  it('is shown for a new user who is not authenticated, but is not shown once they log in', async () => {
    const getApiKeyStub = sandbox.stub(auth, 'getApiKey');
    getApiKeyStub.returns(Promise.resolve(noApiKey));
    sandbox.stub(extensionState, 'firstVersionInstalled').value(newUserVersion);

    await SignInManager.register(extensionState);
    assert(SignInManager.shouldShowSignIn());

    let expectedArgs = ['setContext', 'appMap.showSignIn', true];
    assert.deepStrictEqual(stubbedExecuteCommand.getCall(0).args, expectedArgs);

    // user logs in
    getApiKeyStub.returns(Promise.resolve(fakeApiKey));
    await SignInManager.updateSignInState();
    assert(!SignInManager.shouldShowSignIn());

    expectedArgs = ['setContext', 'appMap.showSignIn', false];
    assert.deepStrictEqual(stubbedExecuteCommand.getCall(1).args, expectedArgs);
  });
});
