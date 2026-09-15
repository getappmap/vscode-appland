import * as vscode from 'vscode';
import { Uri } from 'vscode';

import * as log from '../assets/log';
import ExtensionSettings from '../configuration/extensionSettings';
import { GithubReleaseCache, GitHubReleaseResolver } from '../assets/resolvers';
import { AppMapSkillsDir } from '../assets/helpers';
import runUpdates from '../assets/runUpdates';
import SkillsCache from './skills/skillsCache';
import { syncSkillLinks } from './skills/skillLink';

const INSTALL = 'Install';
const NOT_NOW = 'Not now';
const DISABLE = 'Disable';

// Keeps the AppMap agent skills installed for Claude Code and GitHub Copilot.
//
// The latest release of the skills repository is unpacked into a cache at
// ~/.appmap/skills, and each skill is then linked into every configured agent
// skills directory (~/.claude/skills and ~/.agents/skills by default). Because
// this writes into directories owned by other tools, nothing happens until the
// user has agreed via the `appMap.skills.install` setting. Until they decide,
// they are asked on every activation.
export default class SkillService {
  static register(context: vscode.ExtensionContext): void {
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

    return runUpdates(AppMapSkillsDir(), [() => this.installLatest()], throwOnError);
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
