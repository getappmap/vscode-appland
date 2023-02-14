import assert from 'assert';
import sinon from 'sinon';
import * as vscode from 'vscode';
import AppMapService from '../../../src/appMapService';
import { initializeWorkspace, waitForExtension } from '../util';
import { waitFor } from '../../waitFor';
import { AUTHN_PROVIDER_NAME } from '../../../src/authentication';
import { isNativeError } from 'util/types';

describe('Authenticate', () => {
  let sandbox: sinon.SinonSandbox;
  let appmapService: AppMapService;

  beforeEach(() => (sandbox = sinon.createSandbox()));
  beforeEach(initializeWorkspace);
  beforeEach(async () => (appmapService = await waitForExtension()));

  afterEach(initializeWorkspace);
  afterEach(() => sandbox.restore());

  const session: vscode.AuthenticationSession = {
    id: 'the-id',
    accessToken: 'the-token',
    scopes: ['the-scope'],
    account: { id: 'the-account-id', label: 'the-account-label' },
  };

  describe('with AppMap Server', async () => {
    describe('when not signed in', () => {
      it('is activated by vscode.authentication.getSession', async () => {
        sandbox.stub(appmapService.appmapServerAuthenticationProvider, 'getSessions').resolves([]);
        sandbox
          .stub(appmapService.appmapServerAuthenticationProvider, 'createSession')
          .resolves(session);
        // Can't actually do this flow, because the Login permissions dialog is forbidden.
        // Just assert that the dialog is shown.
        try {
          await vscode.authentication.getSession(AUTHN_PROVIDER_NAME, ['the-scope'], {
            createIfNone: true,
          });
        } catch (e) {
          assert(isNativeError(e));
          // The former happens when running with launch configuration.
          // The latter happens when running the test via CLI
          const messages = [
            'Cannot get password',
            'DialogService: refused to show dialog in tests.',
          ];
          assert(
            messages.indexOf(e.message) !== -1,
            `Message ${e.message} not found in ${messages}`
          );
          return;
        }
        assert(false, 'Expecting a dialag or password exception');
      });
      it('can be performed', async () => {
        sandbox
          .stub(appmapService.appmapServerAuthenticationProvider, 'performSignIn')
          .resolves(session);

        let sessionsChangeEvent:
          | vscode.AuthenticationProviderAuthenticationSessionsChangeEvent
          | undefined;
        appmapService.appmapServerAuthenticationProvider.onDidChangeSessions((e) => {
          sessionsChangeEvent = e;
        });

        const obtainedSession =
          await appmapService.appmapServerAuthenticationProvider.createSession();

        assert(obtainedSession, 'session');
        assert.deepStrictEqual(obtainedSession, session);

        await waitFor('sessionsChangeEvent not received', () => !!sessionsChangeEvent);

        assert(sessionsChangeEvent, 'sessionsChangeEvent');
        assert.deepStrictEqual(sessionsChangeEvent.added, [session]);
        assert(!sessionsChangeEvent.removed);
        assert(!sessionsChangeEvent.changed);
      });
    });
  });
});
