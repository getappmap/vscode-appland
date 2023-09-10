import * as vscode from 'vscode';
import githubApi from '../lib/githubApi';
import { WorkspaceService, WorkspaceServiceInstance } from './workspaceService';
import buildGithubArchiveStore from '../lib/buildGitHubArchiveStore';
import { ArchiveInventory, GitHubArchiveStore } from '../lib/GitHubArchiveStore';
import assert from 'assert';
import { findRepository, gitExtension } from '../lib/git';
import { NodeProcessService } from './nodeProcessService';
import { join } from 'path';
import { mkdir, readFile, rm, writeFile } from 'fs/promises';
import { existsSync } from 'fs';
import { executeCommand } from '../lib/executeCommand';
import executeAppMapCommand from '../lib/executeAppMapCommand';

export const COMPARE_REPORT_INTERVAL = 10000;

class AwaitCompareReportInstance implements WorkspaceServiceInstance {
  private timeout?: NodeJS.Timer;
  private archiveStore?: GitHubArchiveStore;
  private lastArchiveDate = 0;
  private checkingNow = false;

  constructor(public context: vscode.ExtensionContext, public folder: vscode.WorkspaceFolder) {}

  async initialize(): Promise<void> {
    const githubConfiguration = await githubApi(this.context);
    if (!githubConfiguration) return;

    const { octokit } = githubConfiguration;
    this.archiveStore = await buildGithubArchiveStore(this.folder.uri, octokit);
    if (!this.archiveStore) return;

    this.timeout = setInterval(() => this.checkForCompareReport(), COMPARE_REPORT_INTERVAL);
  }

  dispose() {
    if (this.timeout) clearTimeout(this.timeout);
    this.timeout = undefined;
  }

  async checkForCompareReport() {
    if (this.checkingNow) return;

    this.checkingNow = true;
    try {
      return await this.doCheck();
    } finally {
      this.checkingNow = false;
    }
  }

  async doCheck() {
    assert(this.archiveStore);
    const inventory = await this.archiveStore.revisionsAvailable(
      'appmap-preflight',
      this.lastArchiveDate
    );

    if (inventory.lastUpdatedAt > this.lastArchiveDate) {
      NodeProcessService.outputChannel.appendLine(
        `[AwaitCompareReport] Completed check for '${this.folder.uri}' up to ${new Date(
          this.lastArchiveDate
        )}`
      );
    }

    const { entries } = inventory;
    if (entries.size === 0) return;

    const gitApi = gitExtension();
    assert(gitApi);

    const gitRepository = findRepository(this.folder.uri);
    if (!gitRepository) {
      NodeProcessService.outputChannel.appendLine(
        `[AwaitCompareReport] No git repository found in workspace '${this.folder.uri}'`
      );
      return;
    }
    const commits = await gitApi?.getRepository(this.folder.uri)?.log({ maxEntries: 1000 });
    if (!commits) {
      NodeProcessService.outputChannel.appendLine(
        `[AwaitCompareReport] Could not find commits for '${gitRepository}'`
      );
      return;
    }

    const archive = inventory.matchRevision(commits.map((commit) => commit.hash));
    if (!archive) return;

    if (inventory.lastUpdatedAt > this.lastArchiveDate) {
      this.lastArchiveDate = inventory.lastUpdatedAt;
      NodeProcessService.outputChannel.appendLine(
        `[AwaitCompareReport] Found archive update for '${this.folder.uri}' at ${new Date(
          this.lastArchiveDate
        )}`
      );
    }

    const changeReportDir = join(
      this.folder.uri.fsPath,
      ArchiveInventory.changeReportDirFromArchiveEntry(archive)
    );
    if (changeReportDir) {
      try {
        const changeReportCreatedAtStr = await readFile(
          join(changeReportDir, 'createdAt'),
          'utf-8'
        );
        const changeReportCreatedAt = new Date(parseInt(changeReportCreatedAtStr, 10)).getTime();
        if (changeReportCreatedAt >= archive.createdAt) return;
      } catch {
        // No createdAt file available
      }
    }

    const archiveFile = await this.archiveStore.fetch(archive.id);

    if (existsSync(changeReportDir)) await rm(changeReportDir, { recursive: true, force: true });
    await mkdir(changeReportDir, { recursive: true });
    await executeCommand(`tar xzf ${archiveFile} -C ${changeReportDir}`);
    await writeFile(join(changeReportDir, 'createdAt'), archive.createdAt.toString());

    await executeAppMapCommand(
      this.context,
      this.folder,
      ['compare-report', '--source-url', this.folder.uri.toString(), changeReportDir],
      'Unable to compare AppMaps'
    );

    const openReport = async () => {
      vscode.commands.executeCommand(
        'markdown.showPreview',
        vscode.Uri.file(join(changeReportDir, 'report.md'))
      );
    };

    // eslint-disable-next-line prefer-const
    let notifyUser: () => Promise<void> | undefined;

    const sleep = async () => {
      assert(notifyUser);
      setTimeout(notifyUser, 5 * 60 * 1000);
    };

    notifyUser = async () => {
      vscode.window
        .showInformationMessage(
          `A new AppMap Analysis PR report is available for project '${this.folder.name}'. Open it now?`,
          {
            modal: false,
          },
          { title: 'Open', action: openReport },
          { title: 'Sleep for 5 minutes', action: sleep },
          { title: 'Dismiss' }
        )
        .then(async (selection) => {
          if (!selection) return;

          if (!selection.action) return;

          return selection.action();
        });
    };
    notifyUser();
  }
}

export class AwaitCompareReport implements WorkspaceService<AwaitCompareReportInstance> {
  public static readonly serviceId = 'AwaitCompareReport';

  constructor(public context: vscode.ExtensionContext) {}

  async create(folder: vscode.WorkspaceFolder): Promise<AwaitCompareReportInstance> {
    const awaiter = new AwaitCompareReportInstance(this.context, folder);
    await awaiter.initialize();
    return awaiter;
  }
}

export default function awaitCompareReport(context: vscode.ExtensionContext) {
  return new AwaitCompareReport(context);
}
