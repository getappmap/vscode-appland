import * as vscode from 'vscode';

// TODO: Import from @appland/client
type ProxySettings = {
  tool: 'vscode' | 'jetbrains' | 'terminal' | 'other';
  http_proxy: string | undefined;
  https_proxy: string | undefined;
  no_proxy: string[] | string | undefined;
  vscode: {
    'http.proxy': string | undefined;
    'http.noProxy': string[] | undefined;
  };
  env: {
    http_proxy: string | undefined;
    https_proxy: string | undefined;
    no_proxy: string | undefined;
  };
};

export function proxySettings(): ProxySettings {
  let noProxy = vscode.workspace.getConfiguration().get<string[]>('http.noProxy');
  let httpProxy = vscode.workspace.getConfiguration().get<string>('http.proxy');

  if (!noProxy) noProxy = undefined;
  if (!httpProxy) httpProxy = undefined;

  return {
    tool: 'vscode',
    http_proxy: httpProxy || process.env.http_proxy,
    https_proxy: process.env.https_proxy,
    no_proxy: noProxy || process.env.no_proxy,
    vscode: {
      'http.proxy': httpProxy,
      'http.noProxy': noProxy,
    },
    env: {
      http_proxy: process.env.http_proxy,
      https_proxy: process.env.https_proxy,
      no_proxy: process.env.no_proxy,
    },
  };
}

export function isRunningWithProxy(): boolean {
  return proxySettings().http_proxy !== undefined;
}
