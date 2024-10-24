import '../../mock/vscode';

import { expect } from 'chai';
import sinon from 'sinon';

import * as vscode from 'vscode';

import VscodeProtocolRedirect from '../../../../src/authentication/authenticationStrategy/vscodeProtocolRedirect';
import ExtensionSettings from '../../../../src/configuration/extensionSettings';
import AppMapServerAuthenticationHandler from '../../../../src/uri/appmapServerAuthenticationHandler';
import UriHandler from '../../../../src/uri/uriHandler';

describe('VscodeProtocolRedirect', () => {
  let uriHandler: UriHandler;
  let authnHandler: AppMapServerAuthenticationHandler;
  let vscodeProtocolRedirect: VscodeProtocolRedirect;

  beforeEach(() => {
    uriHandler = new UriHandler();
    authnHandler = new AppMapServerAuthenticationHandler('your-nonce-value');
    vscodeProtocolRedirect = new VscodeProtocolRedirect(uriHandler, authnHandler);
    sinon
      .stub(ExtensionSettings, 'appMapServerURL')
      .get(() => vscode.Uri.parse('https://server.appmap.test'));
  });

  afterEach(() => {
    vscodeProtocolRedirect.dispose();
  });

  it('should have the correct authnPath', () => {
    expect(vscodeProtocolRedirect.authnPath).to.equal('authn_provider/vscode');
  });

  it('should redirect to the correct URL', async () => {
    const queryParams = { client_id: '123' };
    const redirectUrl = await vscodeProtocolRedirect.redirectUrl(Object.entries(queryParams));
    expect(redirectUrl).to.equal(
      'vscode-test://appland.appmap/authn-appmap-server?client_id%3D123'
    );
  });
});
