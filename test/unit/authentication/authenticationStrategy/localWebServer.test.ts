import '../../mock/vscode';

import { expect } from 'chai';
import sinon from 'sinon';
import http from 'http';

import LocalWebserver from '../../../../src/authentication/authenticationStrategy/localWebServer';
import AppMapServerAuthenticationHandler from '../../../../src/uri/appmapServerAuthenticationHandler';

describe('LocalWebserver', () => {
  let authnHandler: AppMapServerAuthenticationHandler;
  let localWebserver: LocalWebserver;
  let handleSpy: sinon.SinonSpy<[URLSearchParams], void>;

  beforeEach(async () => {
    localWebserver = new LocalWebserver();
    authnHandler = new AppMapServerAuthenticationHandler();
    handleSpy = sinon.spy(authnHandler, 'handle');
    await localWebserver.prepareSignIn((p) => authnHandler.handle(p));
  });

  afterEach(() => {
    localWebserver.dispose();
    sinon.restore();
  });

  it('should handle standard legacy POST callbacks', (done) => {
    const port = localWebserver.port;
    expect(port).to.not.be.undefined;

    const requestBody = `api_key=YWxpY2U6a2V5`;

    const req = http.request(
      {
        host: '127.0.0.1',
        // even though this is only defensive, test the case here when the nonce is included in the query string.
        path: `/?nonce=${localWebserver.nonce}`,
        port,
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Content-Length': Buffer.byteLength(requestBody),
        },
      },
      (res) => {
        expect(res.statusCode).to.equal(200);
        expect(res.headers['content-type']).to.equal('text/html; charset=utf-8');

        let data = '';
        res.on('data', (chunk) => {
          data += chunk;
        });

        res.on('end', () => {
          try {
            expect(data).to.contain('You are now signed in and can close this page.');
            expect(handleSpy.calledOnce).to.be.true;

            const handleArg = handleSpy.firstCall.args[0];
            expect(handleArg.get('nonce')).to.equal(localWebserver.nonce);
            expect(handleArg.get('api_key')).to.equal('YWxpY2U6a2V5');
            done();
          } catch (err) {
            done(err);
          }
        });
      }
    );

    req.write(requestBody);
    req.end();
  });

  it('should handle modern GET redirects from the unified authn_provider', (done) => {
    const port = localWebserver.port;
    expect(port).to.not.be.undefined;

    http.get(`http://127.0.0.1:${port}/?nonce=${localWebserver.nonce}&code=Ym9iOmtleTI=`, (res) => {
      expect(res.statusCode).to.equal(200);
      expect(res.headers['content-type']).to.equal('text/html; charset=utf-8');

      let data = '';
      res.on('data', (chunk) => {
        data += chunk;
      });

      res.on('end', () => {
        try {
          expect(data).to.contain('You are now signed in and can close this page.');
          expect(handleSpy.calledOnce).to.be.true;

          const handleArg = handleSpy.firstCall.args[0];
          expect(handleArg.get('nonce')).to.equal(localWebserver.nonce);
          expect(handleArg.get('code')).to.equal('Ym9iOmtleTI=');
          done();
        } catch (err) {
          done(err);
        }
      });
    });
  });

  it('should handle GET error parameter with a stylized failure page and defensively escape HTML', (done) => {
    const port = localWebserver.port;
    expect(port).to.not.be.undefined;

    http.get(
      `http://127.0.0.1:${port}/?nonce=${localWebserver.nonce}&error=login_denied&error_description=Access+<b>blocked</b>+%26+%22restricted%22`,
      (res) => {
        expect(res.statusCode).to.equal(200);
        expect(res.headers['content-type']).to.equal('text/html; charset=utf-8');

        let data = '';
        res.on('data', (chunk) => {
          data += chunk;
        });

        res.on('end', () => {
          try {
            expect(data).to.contain('Sign-In Failed');
            // The HTML tags and characters should be defensively escaped
            expect(data).to.contain(
              'Access &lt;b&gt;blocked&lt;/b&gt; &amp; &quot;restricted&quot;'
            );
            expect(data).to.not.contain('<b>blocked</b>');
            expect(handleSpy.calledOnce).to.be.true;

            const handleArg = handleSpy.firstCall.args[0];
            expect(handleArg.get('error')).to.equal('login_denied');
            expect(handleArg.get('error_description')).to.equal(
              'Access <b>blocked</b> & "restricted"'
            );
            done();
          } catch (err) {
            done(err);
          }
        });
      }
    );
  });

  it('should handle POST error parameters with a stylized failure page', (done) => {
    const port = localWebserver.port;
    expect(port).to.not.be.undefined;

    const requestBody = `nonce=${localWebserver.nonce}&error=unauthorized_client&error_description=IP+range+restricted`;

    const req = http.request(
      {
        host: '127.0.0.1',
        port,
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Content-Length': Buffer.byteLength(requestBody),
        },
      },
      (res) => {
        expect(res.statusCode).to.equal(200);
        expect(res.headers['content-type']).to.equal('text/html; charset=utf-8');

        let data = '';
        res.on('data', (chunk) => {
          data += chunk;
        });

        res.on('end', () => {
          try {
            expect(data).to.contain('Sign-In Failed');
            expect(data).to.contain('IP range restricted');
            expect(handleSpy.calledOnce).to.be.true;
            done();
          } catch (err) {
            done(err);
          }
        });
      }
    );

    req.write(requestBody);
    req.end();
  });

  it('should return 404 and not close the server for stray GET requests (e.g., favicon)', (done) => {
    const port = localWebserver.port;
    expect(port).to.not.be.undefined;

    // Send a stray GET request (should 404 but keep the server running)
    http.get(`http://127.0.0.1:${port}/favicon.ico`, (res) => {
      expect(res.statusCode).to.equal(404);

      // Send a valid callback request to prove the server remains active
      http.get(
        `http://127.0.0.1:${port}/?nonce=${localWebserver.nonce}&code=Ym9iOmtleTI=`,
        (res2) => {
          expect(res2.statusCode).to.equal(200);
          expect(handleSpy.calledOnce).to.be.true;
          done();
        }
      );
    });
  });

  it('should return 404 and keep the server running when request has an incorrect nonce', (done) => {
    const port = localWebserver.port;
    expect(port).to.not.be.undefined;

    // Send a request with a wrong nonce (should 404 but keep the server running)
    http.get(`http://127.0.0.1:${port}/?nonce=wrong-nonce&code=Ym9iOmtleTI=`, (res) => {
      expect(res.statusCode).to.equal(404);

      // Send a valid callback request to prove the server remains active
      http.get(
        `http://127.0.0.1:${port}/?nonce=${localWebserver.nonce}&code=Ym9iOmtleTI=`,
        (res2) => {
          expect(res2.statusCode).to.equal(200);
          expect(handleSpy.calledOnce).to.be.true;
          done();
        }
      );
    });
  });

  it('should return 404 for unsupported methods (e.g., PUT)', (done) => {
    const port = localWebserver.port;
    expect(port).to.not.be.undefined;

    const req = http.request(
      {
        host: '127.0.0.1',
        port,
        method: 'PUT',
      },
      (res) => {
        expect(res.statusCode).to.equal(404);
        done();
      }
    );
    req.end();
  });
});
