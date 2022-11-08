import { createServer, Server } from 'http';
import AuthenticationStrategy from '.';
import AppMapServerAuthenticationHandler from '../../uri/appmapServerAuthenticationHandler';
import loginPage from '../../../web/static/html/authn_success.html';
import { URL } from 'url';
import { Disposable } from 'vscode';

export default class LocalWebserver implements AuthenticationStrategy {
  private server?: Server;
  private disposables: Array<Disposable> = [];

  public get authnPath(): string {
    return 'authn_provider';
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

    url.pathname = '/callback';

    params.forEach(([k, v]) => url.searchParams.append(k, v));

    return encodeURIComponent(url.toString());
  }

  // Launch a web server and wait for a form submission containing the API key
  prepareSignIn(): void {
    const server = createServer((req, res) => {
      let body = '';
      req.on('data', (chunk) => (body += chunk));
      req.on('end', () => {
        const url = new URL(req.url as string, `http://${req.headers.host}`);
        switch (url.pathname) {
          case '/':
            res.statusCode = 200;
            res.setHeader('Content-Type', 'text/html');
            res.write(loginPage);
            res.end();
            break;

          case '/callback':
            this.authnHandler.handle(url.searchParams);
            res.writeHead(302, { location: '/' });
            res.end();
            break;

          default:
            res.statusCode = 404;
            res.end();
        }
      });
    });

    this.server = server.listen();
    this.disposables.push(
      this.authnHandler.onCreateSession(() => this.dispose()),
      this.authnHandler.onError(() => this.dispose())
    );
  }

  dispose(): void {
    this.server?.close();
    this.disposables.forEach((d) => d.dispose());
  }
}
