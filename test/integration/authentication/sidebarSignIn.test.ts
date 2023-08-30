import * as vscode from 'vscode';
import assert from 'assert';
import sinon from 'sinon';
import * as auth from '../../../src/authentication';
import SignInManager from '../../../src/services/signInManager';

describe('Sidebar sign-in', () => {
  let sandbox: sinon.SinonSandbox;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let stubbedExecuteCommand: sinon.SinonStub<[command: string, ...rest: any[]], Thenable<unknown>>;
  const fakeApiKey = 'fake api key';
  const noApiKey = undefined;

  beforeEach(() => {
    sandbox = sinon.createSandbox();
    stubbedExecuteCommand = sandbox.stub(vscode.commands, 'executeCommand');
  });

  afterEach(() => {
    sandbox.restore();
  });

  it('is shown for a user who is logged in and then logs out', async () => {
    const getApiKeyStub = sandbox.stub(auth, 'getApiKey');
    getApiKeyStub.returns(Promise.resolve(fakeApiKey));

    await SignInManager.register();
    assert(SignInManager.signedIn);

    let expectedArgs = ['setContext', 'appMap.showSignIn', false];
    assert.deepStrictEqual(stubbedExecuteCommand.getCall(0).args, expectedArgs);

    // user logs out
    getApiKeyStub.returns(Promise.resolve(noApiKey));
    await SignInManager.updateSignInState();
    assert(!SignInManager.signedIn);

    expectedArgs = ['setContext', 'appMap.showSignIn', true];
    assert.deepStrictEqual(stubbedExecuteCommand.getCall(1).args, expectedArgs);
  });

  it('is shown for an existing user who is not authenticated and then logs in', async () => {
    const getApiKeyStub = sandbox.stub(auth, 'getApiKey');
    getApiKeyStub.returns(Promise.resolve(noApiKey));

    await SignInManager.register();
    assert(!SignInManager.signedIn);

    let expectedArgs = ['setContext', 'appMap.showSignIn', true];
    assert.deepStrictEqual(stubbedExecuteCommand.getCall(0).args, expectedArgs);

    // user logs in
    getApiKeyStub.returns(Promise.resolve(fakeApiKey));
    await SignInManager.updateSignInState();
    assert(SignInManager.signedIn);

    expectedArgs = ['setContext', 'appMap.showSignIn', false];
    assert.deepStrictEqual(stubbedExecuteCommand.getCall(1).args, expectedArgs);
  });
});
