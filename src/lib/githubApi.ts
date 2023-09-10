import * as vscode from 'vscode';

import nodeFetch from 'node-fetch';
import { Octokit } from '@octokit/rest';

export type GitHubConnection = {
  octokit: Octokit;
  token: string;
};

export default async function githubApi(
  context: vscode.ExtensionContext
): Promise<GitHubConnection | undefined> {
  let githubToken = await context.secrets.get('github.token');
  if (!githubToken) {
    githubToken = await vscode.window.showInputBox({ title: `Enter your GitHub Token` });
    if (!githubToken) return;

    await context.secrets.store('github.token', githubToken);
  }

  return {
    octokit: new Octokit({ auth: githubToken, request: { fetch: nodeFetch } }),
    token: githubToken,
  };
}
