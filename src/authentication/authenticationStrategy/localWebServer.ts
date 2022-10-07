import { createServer, Server } from 'http';
import AuthenticationStrategy from '.';
import AppMapServerAuthenticationHandler from '../../uri/appmapServerAuthenticationHandler';
import loginPage from '../../../web/static/html/authn_success.html';

export default class LocalWebserver implements AuthenticationStrategy {
  private server?: Server;

  public get authnPath(): string {
    return 'authn_provider/localhost';
  }

  constructor(private readonly authnHandler: AppMapServerAuthenticationHandler) {}

  redirectUrl(params: ReadonlyArray<[string, string]>): string {
    if (!this.server) {
      throw new Error('server is not running');
    }
    const address = this.server.address();
    if (!address) {
      throw new Error('server is not runnning');
    }

    let url;
    if (typeof address === 'string') {
      url = new URL(address.toString());
    } else {
      url = new URL(`http://localhost:${address.port}`);
    }

    params.forEach(([k, v]) => url.searchParams.append(k, v));

    return encodeURIComponent(url.toString());
  }

  // Launch a web server and wait for a form submission containing the API key
  prepareSignIn(): void {
    const server = createServer((req, res) => {
      if (req.method !== 'POST') {
        res.statusCode = 404;
        res.end();
        return;
      }

      let body = '';
      req.on('data', (chunk) => (body += chunk));
      req.on('end', () => {
        const params = new URLSearchParams(body);
        this.authnHandler.handle(params);
        res.statusCode = 200;
        res.setHeader('Content-Type', 'text/html');
        res.write(loginPage);
        res.end();
        server.close();
      });
    });

    this.server = server.listen();
  }

  dispose(): void {
    this.server?.close();
  }
}
