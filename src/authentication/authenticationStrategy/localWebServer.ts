// reference the types for static assets so ts-node can understand them
// eslint-disable-next-line @typescript-eslint/triple-slash-reference
/// <reference path="../../../types/custom.d.ts" />
import loginPage from '../../../web/static/html/authn_success.html';
import errorPage from '../../../web/static/html/authn_error.html';

import { createServer, type Server, type IncomingMessage, type ServerResponse } from 'node:http';
import { debuglog } from 'node:util';

import type { Disposable } from 'vscode';
import { randomUUID } from 'crypto';

const debug = debuglog('appmap-vscode:LocalWebserver');

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function renderErrorPage(message: string): string {
  return errorPage.replace('{{message}}', () => escapeHtml(message));
}

function mergeParams(target: URLSearchParams, source: URLSearchParams): URLSearchParams {
  for (const [key, value] of source) target.set(key, value);
  return target;
}

async function readParams(req: IncomingMessage): Promise<URLSearchParams> {
  const params = new URL(req.url || '', `http://${req.headers.host || '127.0.0.1'}`).searchParams;
  if (req.method === 'POST') {
    return new Promise((resolve, reject) => {
      let body = '';
      req.on('data', (chunk) => (body += chunk));
      req.on('end', () => {
        // actual server does not mix query and body parameters, but we merge them here defensively.
        resolve(mergeParams(params, new URLSearchParams(body)));
      });
      req.on('error', reject);
    });
  }
  return params;
}

export default class LocalWebserver implements Disposable {
  private server?: Server;
  private readonly _nonce: string;

  public get nonce(): string {
    return this._nonce;
  }

  public get port(): number | undefined {
    const address = this.server?.address();
    if (!address || typeof address === 'string') {
      return undefined;
    }
    return address.port;
  }

  public get localUrl(): string | undefined {
    const port = this.port;
    if (!port) {
      return undefined;
    }
    return `http://127.0.0.1:${port}/?nonce=${this._nonce}`;
  }

  constructor() {
    this._nonce = randomUUID();
  }

  // Launch a web server and wait for either a GET or POST callback containing the API key or errors
  async prepareSignIn(onCallback: (params: URLSearchParams) => void): Promise<void> {
    const handleRequest = async (req: IncomingMessage, res: ServerResponse) => {
      if (req.method !== 'GET' && req.method !== 'POST') {
        res.statusCode = 404;
        res.end();
        return;
      }

      const params = await readParams(req);
      const nonce = params.get('nonce');

      // Only handle if the nonce is present and matches our generated nonce.
      // Stray requests (like favicon or browser prefetch) are ignored and return a 404.
      if (nonce !== this._nonce) {
        debug(`Invalid nonce on ${req.url}`);
        res.statusCode = 404;
        res.end();
        return;
      }

      onCallback(params);

      res.statusCode = 200;
      res.setHeader('Content-Type', 'text/html; charset=utf-8');

      const error = params.get('error');
      if (error) {
        const description = params.get('error_description');
        const message = description ? `${error}: ${description}` : error;
        res.write(renderErrorPage(message));
      } else {
        const code = params.get('code') || params.get('api_key');
        if (!code) {
          res.write(renderErrorPage('Missing authentication credentials.'));
        } else {
          res.write(loginPage);
        }
      }

      res.end();
      server.close();
    };

    const server = createServer((req, res) =>
      // Keep the server listening: a failed request is typically an aborted or reset
      // callback, which must not tear down a sign-in that can still succeed on retry.
      // The provider disposes of us once the sign-in settles, one way or another.
      handleRequest(req, res).catch((err) => {
        debug(`Error handling request: ${err}`);
        if (!res.headersSent) res.statusCode = 500;
        res.end();
      })
    );

    // Bind the IPv4 loopback interface explicitly: a wildcard bind puts the callback
    // endpoint on the local network and makes Windows Defender raise its "allow public
    // and private networks" prompt, which is a bad thing to show mid-sign-in.
    //
    // Naming a host defers the bind (node resolves it first), so wait for the port to
    // be assigned — the caller needs `localUrl` as soon as we return.
    await new Promise<void>((resolve, reject) => {
      server.once('error', reject);
      server.listen(0, '127.0.0.1', () => {
        server.removeListener('error', reject);
        resolve();
      });
    });

    this.server = server;
  }

  dispose(): void {
    this.server?.close()?.closeAllConnections();
    this.server = undefined;
  }
}
