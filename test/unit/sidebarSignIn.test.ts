import assert from 'assert';
import fs from 'fs';
import path from 'path';
import sinon from 'sinon';
import vscode from './mock/vscode';

import * as auth from '../../src/authentication';
import SignInManager from '../../src/services/signInManager';
import MockExtensionContext from '../mocks/mockExtensionContext';
import ExtensionState from '../../src/configuration/extensionState';
import { clearCustomerId, setCustomerId } from '../../src/configuration/customerId';

import { wait, waitFor } from '../waitFor';

describe('Sidebar sign-in', () => {
  let sandbox: sinon.SinonSandbox;
  let stubbedExecuteCommand: sinon.SinonStub;
  let getApiKeyStub: sinon.SinonStub<
    [createIfNone: boolean, ssoTarget?: string],
    Promise<string | undefined>
  >;
  const context = new MockExtensionContext();
  const extensionState = new ExtensionState(context);
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

  it('is not shown when authenticated, but is shown after logging out', async () => {
    getApiKeyStub.returns(Promise.resolve(fakeApiKey));

    await SignInManager.register(extensionState, context);
    await expectSignInState('satisfied');

    // user logs out
    getApiKeyStub.returns(Promise.resolve(noApiKey));
    await SignInManager.updateSignInState();
    await expectSignInState('required');
  });

  it('is shown when not authenticated, but is not shown once they log in', async () => {
    getApiKeyStub.returns(Promise.resolve(noApiKey));

    await SignInManager.register(extensionState, context);
    await expectSignInState('required');

    // user logs in
    getApiKeyStub.returns(Promise.resolve(fakeApiKey));
    await SignInManager.updateSignInState();
    await expectSignInState('satisfied');
  });

  // getSession() waits for this extension to finish activating, so register() must not
  // wait for the credential check: awaiting it deadlocks activation against itself and
  // the sidebar never leaves the placeholder.
  it('returns without waiting for the credential check', async () => {
    getApiKeyStub.returns(new Promise(() => undefined));

    await SignInManager.register(extensionState, context);

    assert(
      !stubbedExecuteCommand
        .getCalls()
        .some(({ args }) => args[0] === 'setContext' && args[1] === 'appmap.signInState'),
      'expected no state to be published while the credential check is outstanding'
    );
  });

  // The initial check is the slowest refresh, not the fastest: getSession() waits for this
  // extension to activate. A refresh that starts later therefore routinely publishes first,
  // and the initial one must not come back afterwards and undo it.
  it('discards a check superseded by a later one', async () => {
    let completeInitialCheck!: (apiKey: string | undefined) => void;
    getApiKeyStub.returns(
      new Promise<string | undefined>((resolve) => (completeInitialCheck = resolve))
    );

    await SignInManager.register(extensionState, context);

    // An entitlement arrives while the credential check is outstanding, and resolves first.
    await setCustomerId(context, 'acme-corp', 'orgConfig');
    await expectSignInState('satisfied');

    // The initial check now reports no credential. It was true when it started and is not
    // anymore, so publishing it would put the sign-in view back up for an entitled user.
    completeInitialCheck(undefined);
    await wait(10);

    await expectSignInState('satisfied');
  });

  it('is not shown with no API key when a customer ID entitles the installation', async () => {
    getApiKeyStub.returns(Promise.resolve(noApiKey));
    await setCustomerId(context, 'acme-corp', 'orgConfig');

    await SignInManager.register(extensionState, context);

    await expectSignInState('satisfied');
  });

  it('does not consult the API key at all when entitled', async () => {
    getApiKeyStub.returns(Promise.resolve(noApiKey));
    await setCustomerId(context, 'acme-corp', 'orgConfig');

    await SignInManager.register(extensionState, context);
    await expectSignInState('satisfied');

    assert(getApiKeyStub.notCalled);
  });

  it('is shown again once entitlement is cleared', async () => {
    getApiKeyStub.returns(Promise.resolve(noApiKey));
    await setCustomerId(context, 'acme-corp', 'orgConfig');

    await SignInManager.register(extensionState, context);
    await expectSignInState('satisfied');

    await clearCustomerId(context);
    await SignInManager.updateSignInState();

    await expectSignInState('required');
  });

  // globalState fires no change event of its own, so an entitlement that arrives mid-session
  // has to be announced or the sign-in view stays up until the window reloads.
  it('hides itself when a customer ID arrives mid-session', async () => {
    getApiKeyStub.returns(Promise.resolve(noApiKey));

    await SignInManager.register(extensionState, context);
    await expectSignInState('required');

    await setCustomerId(context, 'acme-corp', 'orgConfig');

    await expectSignInState('satisfied');
  });

  it('reappears when entitlement is withdrawn mid-session', async () => {
    getApiKeyStub.returns(Promise.resolve(noApiKey));
    await setCustomerId(context, 'acme-corp', 'orgConfig');

    await SignInManager.register(extensionState, context);
    await expectSignInState('satisfied');

    await clearCustomerId(context);

    await expectSignInState('required');
  });

  // Both branches of the sign-in UI are gated on a value the extension has to set, so
  // that neither shows while the state is still undetermined. A negated comparison would
  // treat "undetermined" as one of the two known states and undo that.
  it('gates every sign-in affordance on a positive comparison', () => {
    const manifest = JSON.parse(
      fs.readFileSync(path.join(__dirname, '../../package.json'), 'utf8')
    );
    const { views, walkthroughs } = manifest.contributes;
    const clauses: string[] = [
      ...views.appmap.map(({ when }: { when?: string }) => when),
      ...walkthroughs.flatMap(({ steps }: { steps: { when?: string }[] }) =>
        steps.map(({ when }) => when)
      ),
      ...walkthroughs.flatMap(({ steps }: { steps: { completionEvents?: string[] }[] }) =>
        steps.flatMap(({ completionEvents }) => completionEvents ?? [])
      ),
    ].filter((when): when is string => !!when?.includes('signInState'));

    assert(clauses.length > 0, 'expected the manifest to gate something on signInState');

    for (const clause of clauses) {
      // The placeholder is the one thing that may ask whether the state is unset.
      if (clause === '!appmap.signInState') continue;

      assert.match(
        clause,
        /appmap\.signInState == '(required|satisfied)'/,
        `${clause} must compare appmap.signInState positively`
      );
      assert.doesNotMatch(clause, /signInState\s*!=/, `${clause} must not negate the comparison`);
    }
  });

  // The most recent setContext for the key, rather than the most recent command of any
  // kind: register() publishes the state before it opens the walkthrough, so the last
  // call overall is not necessarily this one.
  async function expectSignInState(value: 'required' | 'satisfied'): Promise<void> {
    await waitFor(
      `Expected 'appmap.signInState' context value to be ${value}`,
      () =>
        stubbedExecuteCommand
          .getCalls()
          .filter(({ args }) => args[0] === 'setContext' && args[1] === 'appmap.signInState')
          .at(-1)?.args[2] === value
    );
    assert.strictEqual(SignInManager.signInState, value);
  }
});
