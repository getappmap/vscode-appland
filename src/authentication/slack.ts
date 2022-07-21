import * as vscode from 'vscode';
import AuthenticationProvider from './authenticationProvider';

export const ProviderId = 'slack';
export const AuthnUrl = 'https://slack-app.appland.com/oauth/inbound/vscode';

export function getSession(): Thenable<vscode.AuthenticationSession | undefined> {
  return vscode.authentication.getSession(ProviderId, []);
}

export function register(context: vscode.ExtensionContext): AuthenticationProvider {
  const provider = new AuthenticationProvider({
    provider: 'slack',
    label: 'AppMap Community Slack',
    authUrl: AuthnUrl,
    context,
  });

  context.subscriptions.push(
    vscode.authentication.registerAuthenticationProvider(
      ProviderId,
      'AppMap Community Slack',
      provider,
      { supportsMultipleAccounts: true }
    )
  );

  return provider;
}
