import * as vscode from 'vscode';
import assert from 'assert';
import { Octokit } from '@octokit/rest';

import { GitHubArchiveStore } from './GitHubArchiveStore';
import { findRepository, gitExtension } from './git';
import { NodeProcessService } from '../services/nodeProcessService';

export default async function buildGithubArchiveStore(
  workspaceUri: vscode.Uri,
  octokit: Octokit
): Promise<GitHubArchiveStore | undefined> {
  const gitApi = gitExtension();
  assert(gitApi);

  const gitRepository = findRepository(workspaceUri);
  if (!gitRepository) {
    NodeProcessService.outputChannel.appendLine(
      `[GitHubArchiveStore] No git repository found for workspace ${workspaceUri}`
    );
    return;
  }

  const repoTokens = gitRepository.split('/');
  if (!repoTokens || repoTokens.length < 2) {
    NodeProcessService.outputChannel.appendLine(
      `[GitHubArchiveStore] Invalid GitHub repository format ${gitRepository}`
    );
    return;
  }

  const hostname = repoTokens[repoTokens.length - 3];
  if (hostname !== 'github.com') {
    NodeProcessService.outputChannel.appendLine(
      `[GitHubArchiveStore] Unsupported GitHub repository ${gitRepository}. Only github.com is supported right now.`
    );
    return;
  }

  const owner = repoTokens[repoTokens.length - 2];
  let repoName = repoTokens[repoTokens.length - 1];
  if (repoName.includes('.')) repoName = repoName.split('.')[0];

  const repoResponse = await octokit.repos.get({ owner, repo: repoName });
  if (repoResponse.status !== 200) {
    NodeProcessService.outputChannel.appendLine(
      `[GitHubArchiveStore] Could not find repository ${gitRepository} on github.com.`
    );
    return;
  }

  return new GitHubArchiveStore(octokit, owner, repoName);
}
