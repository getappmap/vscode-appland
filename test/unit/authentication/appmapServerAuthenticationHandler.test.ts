import '../mock/vscode';

import { expect } from 'chai';
import AppMapServerAuthenticationHandler from '../../../src/uri/appmapServerAuthenticationHandler';

describe('AppMapServerAuthenticationHandler', () => {
  let handler: AppMapServerAuthenticationHandler;

  beforeEach(() => {
    handler = new AppMapServerAuthenticationHandler();
  });

  afterEach(() => {
    handler.dispose();
  });

  it('should successfully handle legacy api_key parameter', (done) => {
    // base64: "alice@example.com:some-license-key" is "YWxpY2VAZXhhbXBsZS5jb206c29tZS1saWNlbnNlLWtleQ=="
    const encodedApiKey = 'YWxpY2VAZXhhbXBsZS5jb206c29tZS1saWNlbnNlLWtleQ==';
    const params = new URLSearchParams({
      api_key: encodedApiKey,
    });

    handler.onCreateSession((session) => {
      try {
        expect(session.id).to.equal('alice@example.com');
        expect(session.accessToken).to.equal(encodedApiKey);
        done();
      } catch (err) {
        done(err);
      }
    });

    handler.onError((err) => {
      done(err);
    });

    handler.handle(params);
  });

  it('should successfully handle modern code parameter as alternative to api_key', (done) => {
    // base64: "bob@example.com:some-other-license-key" is "Ym9iQGV4YW1wbGUuY29tOnNvbWUtb3RoZXItbGljZW5zZS1rZXk="
    const encodedCode = 'Ym9iQGV4YW1wbGUuY29tOnNvbWUtb3RoZXItbGljZW5zZS1rZXk=';
    const params = new URLSearchParams({
      code: encodedCode,
    });

    handler.onCreateSession((session) => {
      try {
        expect(session.id).to.equal('bob@example.com');
        expect(session.accessToken).to.equal(encodedCode);
        done();
      } catch (err) {
        done(err);
      }
    });

    handler.onError((err) => {
      done(err);
    });

    handler.handle(params);
  });

  it('should fail and propagate error if error parameter is present', (done) => {
    const params = new URLSearchParams({
      error: 'login_denied',
      error_description: 'The user account is inactive',
    });

    handler.onError((err) => {
      try {
        expect(err.message).to.equal('login_denied: The user account is inactive');
        done();
      } catch (e) {
        done(e);
      }
    });

    handler.onCreateSession(() => {
      done(new Error('should not have created session'));
    });

    handler.handle(params);
  });

  it('should fall back to standard error description if only error is present', (done) => {
    const params = new URLSearchParams({
      error: 'access_denied',
    });

    handler.onError((err) => {
      try {
        expect(err.message).to.equal('access_denied');
        done();
      } catch (e) {
        done(e);
      }
    });

    handler.handle(params);
  });
});
