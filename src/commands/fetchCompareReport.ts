import * as vscode from 'vscode';
import chooseWorkspace from '../lib/chooseWorkspace';
import githubApi from '../lib/githubApi';
import { findRepository, gitExtension } from '../lib/git';
import assert from 'assert';
import { executeCommand } from '../lib/executeCommand';
import { basename, dirname, join } from 'path';
import { mkdir, rm } from 'fs/promises';
import { existsSync } from 'fs';
import executeAppMapCommand from '../lib/executeAppMapCommand';
import buildGithubArchiveStore from '../lib/buildGitHubArchiveStore';
import { ArchiveInventory, GitHubArchiveStore } from '../lib/GitHubArchiveStore';

export default function fetchCompareReport(context: vscode.ExtensionContext) {
  const command = vscode.commands.registerCommand('appmap.fetchCompareReport', async () => {
    const workspaceFolder = await chooseWorkspace();
    if (!workspaceFolder) return;

    const githubConfiguration = await githubApi(context);
    if (!githubConfiguration) return;

    const { octokit } = githubConfiguration;

    const gitApi = gitExtension();
    assert(gitApi);

    const gitRepository = findRepository(workspaceFolder.uri);
    if (!gitRepository) {
      vscode.window.showErrorMessage(
        `No git repository found in workspace '${workspaceFolder.name}'`
      );
      return;
    }
    const commits = await gitApi?.getRepository(workspaceFolder.uri)?.log({ maxEntries: 1000 });
    if (!commits) {
      vscode.window.showErrorMessage(`Could not find commits for ${gitRepository}`);
      return;
    }

    const archiveStore = await buildGithubArchiveStore(workspaceFolder.uri, octokit);
    if (!archiveStore) return;

    const inventory = await archiveStore.revisionsAvailable('appmap-preflight');
    const archive = inventory.matchRevision(commits.map((commit) => commit.hash));
    if (!archive) {
      vscode.window.showInformationMessage(
        `Could not find any remote data matching the current branch`
      );
      return;
    }

    // Example: change-report/72eb941cc8159fa34a2170f2b4312f45f1c821f0-55bf6902f7bd801ebe4b9228aa87bb1d8dd1ec77/appmap-preflight-72eb941cc8159fa34a2170f2b4312f45f1c821f0-55bf6902f7bd801ebe4b9228aa87bb1d8dd1ec77.tar.gz
    const archiveFile = await archiveStore.fetch(archive.id);

    const changeReportDir = ArchiveInventory.changeReportDirFromArchiveFileName(archiveFile);
    const unpackDir = join(workspaceFolder.uri.fsPath, changeReportDir);
    if (existsSync(unpackDir)) await rm(unpackDir, { recursive: true, force: true });
    await mkdir(unpackDir, { recursive: true });
    await executeCommand(`tar xzf ${archiveFile} -C ${unpackDir}`);

    await executeAppMapCommand(
      context,
      workspaceFolder,
      ['compare-report', '--source-url', workspaceFolder.uri.toString(), unpackDir],
      'Unable to compare AppMaps'
    );

    vscode.commands.executeCommand(
      'markdown.showPreview',
      vscode.Uri.file(join(unpackDir, 'report.md'))
    );
  });

  context.subscriptions.push(command);
}
