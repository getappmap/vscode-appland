import { AppMap } from '@appland/client';
import assert from 'assert';
import sinon from 'sinon';
import * as vscode from 'vscode';
import { AppmapUploader } from '../../../src/actions/appmapUploader';

describe('Upload', () => {
  let sandbox: sinon.SinonSandbox;
  let context: vscode.ExtensionContext;

  beforeEach(() => (sandbox = sinon.createSandbox()));

  afterEach(() => sandbox.restore());

  beforeEach(() => {
    const globalState: vscode.Memento = sandbox.mock() as any;
    context = { globalState } as vscode.ExtensionContext;
    sandbox.stub(globalState, 'get').returns(true as any);
  });

  let session: vscode.AuthenticationSession | undefined;

  describe('not logged in', () => {
    it('returns false', async () => {
      sandbox.stub(vscode.authentication, 'getSession').resolves(session);

      const uploadResult = await AppmapUploader.upload(Buffer.from([]), context);
      assert(!uploadResult, 'Expected upload to return false');
    });
  });
  describe('logged in', () => {
    beforeEach(() => {
      session = {
        id: 'the-id',
        accessToken: 'the-token',
        scopes: ['the-scope'],
        account: { id: 'the-account-id', label: 'the-account-label' },
      };
    });

    it('uploads the data', async () => {
      const upload = { uuid: 'the-uuid' };
      sandbox.stub(vscode.authentication, 'getSession').resolves(session);
      sandbox.stub(AppMap, 'create').resolves(upload);

      const uploadResult = await AppmapUploader.upload(Buffer.from([]), context);
      assert(uploadResult);

      const url = await vscode.env.clipboard.readText();
      assert.deepStrictEqual(url, 'https://app.land/scenarios/the-uuid');
    });

    it('uploads an AppMap if the user accepts the terms', async () => {
      const createStub = sandbox.stub(AppMap, 'create').resolves({ uuid: 'the-uuid' });
      const promptStub = sandbox
        .stub(
          (AppmapUploader as unknown) as { userAcceptedTerms(): Promise<boolean> },
          'userAcceptedTerms'
        )
        .resolves(true);
      const performSignIn = sandbox.stub(vscode.authentication, 'getSession').resolves(session);

      await AppmapUploader.upload(Buffer.from(''), context);

      assert(promptStub.calledOnce, 'User was not displayed the terms');
      assert(performSignIn.calledOnce, 'User was not prompted to sign in');
      assert(createStub.calledOnce, 'AppMap upload did not occur');
    });

    it('does not upload an AppMap if the user rejects the terms', async () => {
      const createStub = sandbox.stub(AppMap, 'create').resolves({ uuid: 'the-uuid' });
      const promptStub = sandbox
        .stub(
          (AppmapUploader as unknown) as { userAcceptedTerms(): Promise<boolean> },
          'userAcceptedTerms'
        )
        .resolves(false);
      const performSignIn = sandbox.stub(vscode.authentication, 'getSession').resolves(session);

      await AppmapUploader.upload(Buffer.from(''), context);

      assert(promptStub.calledOnce, 'User was not displayed the terms');
      assert(!performSignIn.calledOnce, 'User was prompted to sign in');
      assert(!createStub.calledOnce, 'The AppMap upload occurred');
    });
  });
});
