import * as vscode from 'vscode';

export default function proxiedFetch(url: string, init?: RequestInit): Promise<Response> {
  const httpProxy =
    vscode.workspace.getConfiguration('http').get<string>('proxy') ||
    process.env.HTTP_PROXY ||
    process.env.HTTPS_PROXY;

  if (httpProxy) {
    const proxyAuthorization = vscode.workspace
      .getConfiguration('http')
      .get<string>('proxyAuthorization');
    const options = init || {};
    const proxyUrl = new URL(httpProxy);
    const { host, pathname, search } = new URL(url);
    proxyUrl.pathname = pathname;
    proxyUrl.search = search;

    options.headers = {
      ...(options.headers || {}),
      Host: host,
    };

    if (proxyAuthorization && options.headers) {
      options.headers['Proxy-Authorization'] = proxyAuthorization;
    }

    return fetch(proxyUrl.toString(), {
      ...options,
      headers: {
        ...options.headers,
        host,
      },
    });
  }

  return fetch(url, init);
}
