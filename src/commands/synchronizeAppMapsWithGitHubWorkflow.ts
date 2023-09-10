import * as vscode from 'vscode';
import chooseWorkspace from '../lib/chooseWorkspace';
import { findRepository, gitExtension } from '../lib/git';
import githubApi from '../lib/githubApi';
import assert from 'assert';
import { existsSync } from 'fs';
import { rm } from 'fs/promises';
import executeAppMapCommand from '../lib/executeAppMapCommand';

export default function synchronizeAppMapsWithGitHubWorkflow(context: vscode.ExtensionContext) {
  const command = vscode.commands.registerCommand('appmap.synchronize.github', async () => {
    const workspaceFolder = await chooseWorkspace();
    if (!workspaceFolder) return;

    const gitRepository = findRepository(workspaceFolder.uri);
    if (!gitRepository) {
      vscode.window.showErrorMessage('No git repository found');
      return;
    }

    let commit: string | undefined;
    {
      const ext = gitExtension();
      assert(ext);
      commit = ext.getRepository(workspaceFolder.uri)?.state.HEAD?.commit;
    }
    if (!commit) {
      vscode.window.showErrorMessage('No git commit found');
      return;
    }

    const githubConnection = await githubApi(context);
    if (!githubConnection) return;

    const { token: githubToken } = githubConnection;

    const repoTokens = gitRepository.split('/');
    if (!repoTokens || repoTokens.length < 2) {
      vscode.window.showErrorMessage(`Invalid GitHub repository format ${gitRepository}`);
      return;
    }

    const hostname = repoTokens[repoTokens.length - 3];
    if (hostname !== 'github.com') {
      vscode.window.showErrorMessage(
        `Unsupported GitHub repository ${gitRepository}. Only github.com is supported right now.`
      );
      return;
    }

    const owner = repoTokens[repoTokens.length - 2];
    let repo = repoTokens[repoTokens.length - 1];
    if (repo.includes('.')) repo = repo.split('.')[0];

    if (existsSync(`${workspaceFolder.uri.fsPath}/.appmap/work/${commit}`)) {
      vscode.window.withProgress({ location: vscode.ProgressLocation.Window }, async (progress) => {
        progress.report({ message: `Removing existing AppMaps for ${commit}...` });
        await rm(`${workspaceFolder.uri.fsPath}/.appmap/work/${commit}`, {
          recursive: true,
          force: true,
        });
      });
    }

    await executeAppMapCommand(
      context,
      workspaceFolder,
      ['restore', '--github-repo', `${owner}/${repo}`, '--revision', commit],
      'Unable to restore AppMaps from GitHub. Please verify that build artifacts are available for this repo, branch and commit.',
      { env: { GITHUB_TOKEN: githubToken } }
    );
  });
  context.subscriptions.push(command);
}
