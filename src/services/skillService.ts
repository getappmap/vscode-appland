import * as vscode from 'vscode';
import { Uri } from 'vscode';

import * as log from '../assets/log';
import ExtensionSettings from '../configuration/extensionSettings';
import { GithubReleaseCache, GitHubReleaseResolver } from '../assets/resolvers';
import { AppMapSkillsDir } from '../assets/helpers';
import runUpdates from '../assets/runUpdates';
import SkillsCache from './skills/skillsCache';
import { syncSkillLinks } from './skills/skillLink';
import { addAppMapMcpServer, hasAppMapMcpServer } from './skills/mcpConfig';

const INSTALL = 'Install';
const NOT_NOW = 'Not now';
const DISABLE = 'Disable';

const ADD = 'Add';
const DONT_ASK_AGAIN = "Don't ask again";
// Workspace-state key listing folders where the user declined the MCP entry.
const MCP_DECLINED_KEY = 'appMap.skills.mcpDeclined';

// Keeps the AppMap agent skills installed for Claude Code and GitHub Copilot.
//
// The latest release of the skills repository is unpacked into a cache at
// ~/.appmap/skills, and each skill is then linked into every configured agent
// skills directory (~/.claude/skills and ~/.agents/skills by default). This
// is on by default and controlled by the `appMap.skills.install` setting; when
// it is set to `prompt`, the user is asked on every activation until they
// choose.
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
    switch (ExtensionSettings.skillsInstall) {
      case 'disabled':
        log.info('AppMap skills installation is disabled, skipping.');
        return;
      case 'prompt':
        if (!(await this.askForConsent())) return;
        break;
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

  // Ask whether we may write into the agent skills directories. "Install" and
  // "Disable" are both recorded in the user's settings, so the question is
  // asked again only until they have made a lasting choice.
  private static async askForConsent(): Promise<boolean> {
    const dirs = ExtensionSettings.skillsDirectories.join(' and ');
    const choice = await vscode.window.showInformationMessage(
      `AppMap can install its agent skills for Claude Code and GitHub Copilot into ${dirs}, and keep them up to date. Install them?`,
      INSTALL,
      NOT_NOW,
      DISABLE
    );

    if (choice === INSTALL || choice === DISABLE) {
      await vscode.workspace
        .getConfiguration('appMap')
        .update(
          'skills.install',
          choice === INSTALL ? 'enabled' : 'disabled',
          vscode.ConfigurationTarget.Global
        );
    }
    return choice === INSTALL;
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
