import * as vscode from 'vscode';
import { Uri } from 'vscode';

import * as log from '../assets/log';
import Environment from '../configuration/environment';
import ExtensionSettings from '../configuration/extensionSettings';
import { GithubReleaseCache, GitHubReleaseResolver } from '../assets/resolvers';
import { AppMapSkillsDir } from '../assets/helpers';
import runUpdates from '../assets/runUpdates';
import SkillsCache from './skills/skillsCache';
import { syncSkillLinks } from './skills/skillLink';
import { addAppMapMcpServer, hasAppMapMcpServer } from './skills/mcpConfig';

const ADD = 'Add';
const NOT_NOW = 'Not now';
const DONT_ASK_AGAIN = "Don't ask again";
// Workspace-state key listing folders where the user declined the MCP entry.
const MCP_DECLINED_KEY = 'appMap.skills.mcpDeclined';

// Keeps the AppMap agent skills installed for Claude Code and GitHub Copilot.
//
// The latest release of the skills repository is unpacked into a cache at
// ~/.appmap/skills, and each skill is then linked into every configured agent
// skills directory (~/.claude/skills and ~/.agents/skills by default). This
// is on by default and controlled by the `appMap.skills.install` setting.
//
// Once the skills are installed, each open workspace is offered the AppMap
// MCP server in its .vscode/mcp.json. That file is checked into the user's
// repository, so it is never written without asking.
export default class SkillService {
  private static workspaceState: vscode.Memento | undefined;

  static register(context: vscode.ExtensionContext): void {
    this.workspaceState = context.workspaceState;
    context.subscriptions.push(
      vscode.workspace.onDidChangeConfiguration((e) => {
        if (e.affectsConfiguration('appMap.skills')) {
          GithubReleaseCache.clear();
          void this.ensureInstalled();
        }
      })
    );
  }

  // Resolves once the skills are installed, or immediately if the user has
  // not enabled installation. Errors are logged unless `throwOnError` is set.
  static async ensureInstalled(throwOnError = false): Promise<void> {
    // The skills directories belong to Claude Code and Copilot, not to us, and
    // they live in the real home directory of whoever runs the suite — the
    // isolated --user-data-dir doesn't cover them. The unit tests exercise this
    // code against a temporary home instead.
    if (Environment.isIntegrationTest) {
      log.info('Skipping AppMap skills installation in an integration test.');
      return;
    }

    if (!ExtensionSettings.skillsInstall) {
      log.info('AppMap skills installation is disabled, skipping.');
      return;
    }

    await runUpdates(AppMapSkillsDir(), [() => this.installLatest()], throwOnError);
    await this.configureWorkspaces(throwOnError);
  }

  // Offer the AppMap MCP server to each open workspace that doesn't have it.
  // This runs outside the lock on purpose: the lock is per home directory, but
  // the workspaces differ per window, so a window that skipped the shared
  // update must still do this part.
  private static async configureWorkspaces(throwOnError: boolean): Promise<void> {
    for (const folder of vscode.workspace.workspaceFolders ?? []) {
      try {
        await this.offerMcpServer(folder);
      } catch (e) {
        if (throwOnError) throw e;
        log.error(`Failed to add the AppMap MCP server to ${folder.uri.fsPath}: ${e}`);
      }
    }
  }

  private static async offerMcpServer(folder: vscode.WorkspaceFolder): Promise<void> {
    const path = folder.uri.fsPath;
    if (await hasAppMapMcpServer(path)) return;
    if (this.mcpDeclined().includes(path)) return;

    const choice = await vscode.window.showInformationMessage(
      `Add the AppMap MCP server to .vscode/mcp.json in ${folder.name}? This lets Copilot and other MCP clients query your AppMap data.`,
      ADD,
      NOT_NOW,
      DONT_ASK_AGAIN
    );

    if (choice === ADD) {
      await addAppMapMcpServer(path);
      log.info(`Added the AppMap MCP server to ${path}`);
    } else if (choice === DONT_ASK_AGAIN) {
      await this.workspaceState?.update(MCP_DECLINED_KEY, [...this.mcpDeclined(), path]);
    }
  }

  private static mcpDeclined(): string[] {
    return this.workspaceState?.get<string[]>(MCP_DECLINED_KEY) ?? [];
  }

  private static async installLatest(): Promise<void> {
    const repository = ExtensionSettings.skillsRepository;
    const version = await new GitHubReleaseResolver(repository).getLatestVersion();
    if (!version) throw new Error('Error resolving the latest AppMap skills version');

    const cache = new SkillsCache(AppMapSkillsDir());
    await cache.update(
      version,
      Uri.parse(`https://github.com/${repository}/archive/refs/tags/v${version}.tar.gz`)
    );

    for (const dir of ExtensionSettings.skillsDirectories) await syncSkillLinks(cache, dir);
  }
}
