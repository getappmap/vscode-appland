import * as vscode from 'vscode';
import chooseWorkspace from '../lib/chooseWorkspace';
import { findRepository, gitExtension } from '../lib/git';
import githubApi from '../lib/githubApi';
import {
  ProgramName,
  getModulePath,
  spawn,
  verifyCommandOutput,
} from '../services/nodeDependencyProcess';
import { workspaceServices } from '../services/workspaceServices';
import { AppmapConfigManager } from '../services/appmapConfigManager';
import assert from 'assert';
import { DEBUG_EXCEPTION, Telemetry } from '../telemetry';
import ErrorCode from '../telemetry/definitions/errorCodes';
import { existsSync } from 'fs';
import { rm } from 'fs/promises';
import { log } from 'console';

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

    const modulePath = await getModulePath({
      dependency: ProgramName.Appmap,
      globalStoragePath: context.globalStorageUri.fsPath,
    });

    if (existsSync(`${workspaceFolder.uri.fsPath}/.appmap/work/${commit}`)) {
      vscode.window.withProgress({ location: vscode.ProgressLocation.Window }, async (progress) => {
        progress.report({ message: `Removing existing AppMaps for ${commit}...` });
        await rm(`${workspaceFolder.uri.fsPath}/.appmap/work/${commit}`, {
          recursive: true,
          force: true,
        });
      });
    }

    const cmdArgs = {
      modulePath,
      args: ['restore', '--github-repo', `${owner}/${repo}`, '--revision', commit],
      cwd: workspaceFolder.uri.fsPath,
      saveOutput: true,
      env: { GITHUB_TOKEN: githubToken },
    };
    log(JSON.stringify(cmdArgs, null, 2));
    const restoreCommand = spawn(cmdArgs);
    restoreCommand.addListener('data', process.stderr.write.bind(process.stderr));

    try {
      await verifyCommandOutput(restoreCommand);
    } catch (e) {
      Telemetry.sendEvent(DEBUG_EXCEPTION, {
        exception: e as Error,
        errorCode: ErrorCode.RestoreFailure,
        log: restoreCommand.log.toString(),
      });
      vscode.window.showWarningMessage(
        'Unable to restore AppMaps from GitHub. Please verify that build artifacts are available for this repo, branch and commit.'
      );
      return;
    }
  });
  context.subscriptions.push(command);
}
