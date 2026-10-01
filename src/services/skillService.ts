import * as vscode from 'vscode';
import { Uri } from 'vscode';

import * as log from '../assets/log';
import Environment from '../configuration/environment';
import ExtensionSettings from '../configuration/extensionSettings';
import { GithubReleaseCache, GitHubReleaseResolver } from '../assets/resolvers';
import { AppMapSkillsDir, displayPath } from '../assets/helpers';
import runUpdates from '../assets/runUpdates';
import SkillsCache from './skills/skillsCache';
import { installedSkills, removeSkillLinks, syncSkillLinks } from './skills/skillLink';
import { addAppMapMcpServers, mcpJsonPath, missingAppMapMcpServers } from './skills/mcpConfig';

// The harmless choice comes first in every one of these: a notification that
// appears unbidden will be dismissed by reflex, and that shouldn't uninstall
// anything or write to a repository.
const OK = 'OK';
const UNINSTALL = 'Uninstall';
const KEEP = 'Keep them';
const REMOVE = 'Remove';

const OPEN_MCP_JSON = 'Open mcp.json';
const TURN_OFF = 'Turn off';
const TURN_ON = 'Turn on';
// The command that turns automatic MCP configuration on or off per repository.
// Its title must match package.json.
const MCP_TOGGLE_COMMAND = 'appmap.mcp.toggleAutoConfigure';
const MCP_TOGGLE_TITLE = 'AppMap: Toggle Automatic MCP Configuration';
// Every MCP notification ends with this, so the user always knows how to
// change the behavior later, once the notification is gone.
const MCP_MANAGE_HINT = `Run "${MCP_TOGGLE_TITLE}" to disable automatic MCP configuration.`;
// Global-state flag: the user has been told the skills exist.
const INSTALL_NOTIFIED_KEY = 'appMap.skills.installNotified';

// Keeps the AppMap agent skills installed for Claude Code and GitHub Copilot.
//
// The latest release of the skills repository is unpacked into a cache at
// ~/.appmap/skills, and each skill is then linked into every configured agent
// skills directory (~/.claude/skills and ~/.agents/skills by default). This
// is on by default and controlled by the `appMap.skills.install` setting.
//
// The first time skills land on disk, the user is told once, and offered a
// way out; after that we update them silently.
//
// Separately, and whether or not any skills were installed, the AppMap MCP
// servers are added to .vscode/mcp.json in each open workspace: that file is
// useful to Copilot in VS Code on its own. Entries already there are never
// changed, and every change we make is announced with a way to open the file.
// This is controlled per repository by `appMap.mcp.autoConfigure`; turning it
// on or off is announced too, so the user knows what will happen next time.
export default class SkillService {
  private static globalState: vscode.Memento | undefined;
  // The last value of `appMap.mcp.autoConfigure` seen for each workspace
  // folder, keyed by path. A configuration change event only says that the
  // setting changed somewhere; comparing against this tells which folders it
  // actually changed for, so that only those are announced.
  private static autoConfigure = new Map<string, boolean>();

  static register(context: vscode.ExtensionContext): void {
    this.globalState = context.globalState;
    this.autoConfigure = new Map();
    context.subscriptions.push(
      vscode.workspace.onDidChangeConfiguration((e) => {
        if (e.affectsConfiguration('appMap.skills')) {
          GithubReleaseCache.clear();
          void this.ensureInstalled();
        }
        if (e.affectsConfiguration('appMap.mcp.autoConfigure')) void this.announceAutoConfigure();
      }),
      vscode.commands.registerCommand(MCP_TOGGLE_COMMAND, () => this.toggleMcp())
    );
  }

  // Turn automatic MCP configuration on or off for a repository: the one
  // given, or else the one the user picks when more than one is open.
  private static async toggleMcp(folder?: vscode.WorkspaceFolder): Promise<void> {
    const folders = vscode.workspace.workspaceFolders ?? [];
    if (!folder && folders.length === 0) {
      vscode.window.showInformationMessage('Open a repository to change AppMap MCP configuration.');
      return;
    }

    if (!folder) folder = folders[0];
    if (!folder || folders.length > 1) {
      const choices = folders.map((workspaceFolder) => ({
        label: workspaceFolder.name,
        description: workspaceFolder.uri.fsPath,
        folder: workspaceFolder,
      }));
      const choice = await vscode.window.showQuickPick(choices, {
        placeHolder: 'Select the repository for AppMap MCP configuration',
      });
      if (!choice) return;
      folder = choice.folder;
    }

    const enabled = !this.autoConfigureEnabled(folder);
    await vscode.workspace
      .getConfiguration('appMap', folder.uri)
      .update('mcp.autoConfigure', enabled, vscode.ConfigurationTarget.WorkspaceFolder);
    // Announced here rather than left to the configuration change event: the
    // event may not fire (if the value was already what we wrote), and when it
    // does, the folder is already recorded, so it is not announced twice.
    await this.announceAutoConfigure([folder]);
  }

  private static autoConfigureEnabled(folder: vscode.WorkspaceFolder): boolean {
    return (
      vscode.workspace.getConfiguration('appMap', folder.uri).get<boolean>('mcp.autoConfigure') ??
      true
    );
  }

  // Reads the setting for a folder, records it, and says whether it differs
  // from the last recorded value.
  private static recordAutoConfigure(folder: vscode.WorkspaceFolder): {
    enabled: boolean;
    changed: boolean;
  } {
    const enabled = this.autoConfigureEnabled(folder);
    const changed = this.autoConfigure.get(folder.uri.fsPath) !== enabled;
    this.autoConfigure.set(folder.uri.fsPath, enabled);
    return { enabled, changed };
  }

  // Tell the user what the setting now means for each folder it changed for.
  // Turning it on adds any missing servers right away, and that is its own
  // announcement; otherwise the user is told the file is already complete.
  private static async announceAutoConfigure(
    folders: readonly vscode.WorkspaceFolder[] = vscode.workspace.workspaceFolders ?? []
  ): Promise<void> {
    for (const folder of folders) {
      const { enabled, changed } = this.recordAutoConfigure(folder);
      if (!changed) continue;

      if (!enabled) {
        await this.notifyMcp(
          `Automatic AppMap MCP configuration is off${folderLabel(folder, 'for')}. ` +
            'AppMap will not change .vscode/mcp.json; existing entries were not removed. ' +
            MCP_MANAGE_HINT,
          folder,
          TURN_ON
        );
        continue;
      }

      const result = await this.configureWorkspace(folder, false);
      if (result === 'present')
        await this.notifyMcp(
          `Automatic AppMap MCP configuration is on${folderLabel(folder, 'for')}. ` +
            'The AppMap MCP servers are already in .vscode/mcp.json. ' +
            MCP_MANAGE_HINT,
          folder,
          OPEN_MCP_JSON,
          TURN_OFF
        );
    }
  }

  // An MCP notification. The buttons act rather than explain: open the file,
  // or flip the setting for this repository, which is announced in turn.
  private static async notifyMcp(
    message: string,
    folder: vscode.WorkspaceFolder,
    ...actions: string[]
  ): Promise<void> {
    const choice = await vscode.window.showInformationMessage(message, ...actions);
    if (choice === OPEN_MCP_JSON) {
      await vscode.window.showTextDocument(vscode.Uri.file(mcpJsonPath(folder.uri.fsPath)));
    } else if (choice === TURN_OFF || choice === TURN_ON) {
      await this.toggleMcp(folder);
    }
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

    // Independent of the skills: .vscode/mcp.json is read by Copilot in VS
    // Code and by any other MCP client, whether or not this machine has an
    // agent that reads skills at all. They run concurrently because each can
    // end in a notification, and a notification with buttons on it sits there
    // until the user deals with it -- awaiting one in turn would mean the MCP
    // offer never appears for a user who ignores the skills notification.
    const results = await Promise.allSettled([
      this.installSkills(throwOnError),
      this.configureWorkspaces(throwOnError),
    ]);
    for (const result of results) if (result.status === 'rejected') throw result.reason;
  }

  private static async installSkills(throwOnError: boolean): Promise<void> {
    if (!ExtensionSettings.skillsInstall) {
      log.info('AppMap skills installation is disabled, skipping.');
      return;
    }

    const cache = new SkillsCache(AppMapSkillsDir());
    await runUpdates(AppMapSkillsDir(), [() => this.installLatest(cache)], throwOnError);
    await this.announceInstall(cache);
  }

  // Tell the user, once, that we put files in their agent's configuration
  // directory. The alternative -- asking first -- means everyone pays for a
  // dialog before they have any idea what the skills are for, and the skills
  // are what make AppMap useful to a coding agent at all.
  private static async announceInstall(cache: SkillsCache): Promise<void> {
    const state = this.globalState;
    if (!state) return log.info('No global state, skipping the AppMap skills notification.');
    if (state.get<boolean>(INSTALL_NOTIFIED_KEY)) return;

    // Determined from what is actually on disk: the update may have failed, or
    // been done by another window, or found everything already in place.
    const installed: string[] = [];
    for (const dir of ExtensionSettings.skillsDirectories)
      if ((await installedSkills(cache, dir)).length > 0) installed.push(dir);
    if (installed.length === 0) return;

    // Recorded before the notification is shown, not after: it sits there
    // until it's dismissed, and a second window must not raise its own copy.
    await state.update(INSTALL_NOTIFIED_KEY, true);

    const choice = await vscode.window.showInformationMessage(
      `AppMap installed its agent skills in ${displayPaths(installed)}. ` +
        'They teach Claude Code and GitHub Copilot to record AppMaps of your code and ' +
        'answer questions about how it actually runs.',
      OK,
      UNINSTALL
    );
    if (choice === UNINSTALL) await this.confirmUninstall(cache);
  }

  // Confirmed separately, and spelled out, because the skills are how the
  // agent knows what to do with AppMap: someone who removes them on reflex
  // loses most of the value of the extension without being told.
  private static async confirmUninstall(cache: SkillsCache): Promise<void> {
    const choice = await vscode.window.showWarningMessage(
      'Remove the AppMap agent skills? Claude Code and GitHub Copilot will no longer ' +
        "know how to record AppMaps or explore your application's behavior, and AppMap's " +
        'AI features will be much less effective.',
      KEEP,
      REMOVE
    );
    if (choice !== REMOVE) return;

    // The cache under ~/.appmap stays: it's our own directory, and it makes
    // turning the setting back on instant.
    for (const dir of ExtensionSettings.skillsDirectories) {
      const removed = await removeSkillLinks(cache, dir);
      if (removed.length) log.info(`Removed AppMap skills from ${dir}: ${removed.join(', ')}`);
    }
    await vscode.workspace
      .getConfiguration('appMap')
      .update('skills.install', false, vscode.ConfigurationTarget.Global);

    vscode.window.showInformationMessage(
      'Removed the AppMap agent skills. Set `appMap.skills.install` to reinstall them.'
    );
  }

  // Add the AppMap MCP servers to each open workspace that lacks any of them,
  // skipping workspaces where automatic configuration is turned off.
  // Entries already present, however configured, are never changed.
  // This runs outside the skills lock on purpose: the lock is per home directory, but
  // the workspaces differ per window, so a window that skipped the shared
  // update must still do this part.
  private static async configureWorkspaces(throwOnError: boolean): Promise<void> {
    for (const folder of vscode.workspace.workspaceFolders ?? []) {
      if (!this.recordAutoConfigure(folder).enabled) continue;
      await this.configureWorkspace(folder, throwOnError);
    }
  }

  // Adds the missing servers to one workspace, telling the user about any
  // failure. Reports whether anything was added, or everything was already there.
  private static async configureWorkspace(
    folder: vscode.WorkspaceFolder,
    throwOnError: boolean
  ): Promise<'added' | 'present' | 'failed'> {
    try {
      return await this.addMcpServers(folder);
    } catch (e) {
      // A file we could not write will fail the same way on every
      // activation; the user has to know to fix it.
      vscode.window.showErrorMessage(
        `Could not add the AppMap MCP servers to .vscode/mcp.json${folderLabel(folder, 'in')}: ${
          e instanceof Error ? e.message : e
        }`
      );
      if (throwOnError) throw e;
      log.error(`Failed to add the AppMap MCP servers to ${folder.uri.fsPath}: ${e}`);
      return 'failed';
    }
  }

  private static async addMcpServers(folder: vscode.WorkspaceFolder): Promise<'added' | 'present'> {
    const path = folder.uri.fsPath;
    const missing = await missingAppMapMcpServers(path);
    if (missing.length === 0) return 'present';

    await addAppMapMcpServers(path, missing);
    log.info(`Added the AppMap MCP servers ${missing.join(', ')} to ${path}`);

    await this.notifyMcp(
      `AppMap added the MCP servers ${missing.join(', ')} to .vscode/mcp.json${folderLabel(
        folder,
        'in'
      )}, ` +
        'so Copilot and other MCP clients can query your AppMap data. ' +
        MCP_MANAGE_HINT,
      folder,
      OPEN_MCP_JSON,
      TURN_OFF
    );
    return 'added';
  }

  private static async installLatest(cache: SkillsCache): Promise<void> {
    const repository = ExtensionSettings.skillsRepository;
    const version = await new GitHubReleaseResolver(repository).getLatestVersion();
    if (!version) throw new Error('Error resolving the latest AppMap skills version');

    await cache.update(
      version,
      Uri.parse(`https://github.com/${repository}/archive/refs/tags/v${version}.tar.gz`)
    );

    // Every directory is attempted even if an earlier one fails: one that is
    // unwritable, or that has a plain file where we expect a directory, would
    // otherwise keep the skills out of all the others for good. The first
    // failure is still reported once they have all had their turn.
    const failures: unknown[] = [];
    for (const dir of ExtensionSettings.skillsDirectories) {
      try {
        await syncSkillLinks(cache, dir);
      } catch (e) {
        failures.push(e);
        log.error(`Failed to install the AppMap skills into ${dir}: ${e}`);
      }
    }
    if (failures.length > 0) throw failures[0];
  }
}

// Names the workspace folder in a notification only when there is more than
// one, since otherwise the user already knows which project is open. When it
// is named, it is called a folder: a bare name after "in" reads like a product
// or a place, not a directory.
function folderLabel(folder: vscode.WorkspaceFolder, preposition: 'in' | 'for'): string {
  if ((vscode.workspace.workspaceFolders?.length ?? 0) <= 1) return '';
  return ` ${preposition} the "${folder.name}" workspace folder`;
}

// A list of paths for the user to read: `~/.claude/skills and ~/.agents/skills`.
function displayPaths(paths: string[]): string {
  const display = paths.map(displayPath);
  if (display.length < 2) return display.join('');
  return `${display.slice(0, -1).join(', ')} and ${display[display.length - 1]}`;
}
