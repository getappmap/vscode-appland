import { exec } from 'node:child_process';
import { promisify } from 'node:util';

import * as vscode from 'vscode';

import type { GitExtension, Repository } from '../../types/vscode.git';

const execPromise = promisify(exec);

/**
 * Workspace state key used to persist the last selected reference for quick review.
 * This enables the extension to show the previously selected reference at the top
 * of the quick pick list for improved user experience.
 */
const LAST_PICKED_STATE = 'appmap.quickReview.lastPicked';

export default class QuickReviewCommand {
  /**
   * Executes the quick review command, allowing users to select a Git reference
   * to use as the base for code review.
   *
   * The command:
   * 1. Finds the current Git repository
   * 2. Gets available references (branches, tags, commits)
   * 3. Shows a quick pick UI to select a reference
   * 4. Launches the Navie review command with the selected reference
   *
   * @param context - The extension context to access workspace state
   * @returns A promise that resolves when the command completes
   */
  public static async execute(context: vscode.ExtensionContext): Promise<void> {
    try {
      const repo = await getCurrentRepository();
      if (!repo) return;

      const items = (async () => {
        let items = await getItems(repo);
        const head = repo.state.HEAD?.commit;

        // Don't show "HEAD" items if there are no uncommitted changes
        if (repo.state.workingTreeChanges.length === 0 && repo.state.indexChanges.length === 0) {
          items = items.filter((item) => item.commit !== head);
        }

        const lastPickedRef = context.workspaceState.get<string>(LAST_PICKED_STATE);
        let showFirstIdx = items.findIndex((item) => {
          if (item.label === lastPickedRef) {
            item.description = 'last used ⋅ ' + item.description;
            return true;
          } else return false;
        });
        if (showFirstIdx === -1)
          // try to show common main branches, like "main" or "master" first
          showFirstIdx = items.findIndex((item) => COMMON_MAIN_BRANCHES.includes(item.label));
        if (showFirstIdx !== -1) {
          const lastRef = items.splice(showFirstIdx, 1)[0];
          lastRef.alwaysShow = true;
          items.unshift(lastRef, {
            ...lastRef,
            kind: vscode.QuickPickItemKind.Separator,
            alwaysShow: true,
            label: '',
          });
        }

        return items.map((item) => ({
          ...item,
          description: item.commit === head ? 'review uncommitted changes' : item.description,
          iconPath:
            COMMON_MAIN_BRANCH_ICONS[item.label] ||
            ICONS[item.type] ||
            new vscode.ThemeIcon('git-commit'),
        }));
      })();

      // Show quick pick for ref selection
      // note we pass items as promise, this will show a loading indicator
      const selectedRef = await vscode.window.showQuickPick(items, {
        placeHolder: 'Select base ref for review',
        ignoreFocusOut: true,
        matchOnDescription: true,
      });

      if (!selectedRef) {
        return; // User cancelled
      }

      const baseRef = selectedRef.label;
      // Store the last picked ref in workspace state
      context.workspaceState.update(LAST_PICKED_STATE, baseRef);

      // Open Navie chat with review command
      const prompt = `@review /base=${baseRef}`;
      await vscode.commands.executeCommand('appmap.explain', {
        suggestion: {
          label: prompt,
          prompt,
        },
      });
    } catch (error) {
      vscode.window.showErrorMessage(
        `Failed to start code review: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Registers the quick review command with VS Code.
   *
   * @param context - The extension context to register the command with
   */
  public static register(context: vscode.ExtensionContext): void {
    const command = vscode.commands.registerCommand('appmap.navie.quickReview', () =>
      QuickReviewCommand.execute(context)
    );
    context.subscriptions.push(command);
  }
}

async function getGitExtension(): Promise<GitExtension | undefined> {
  const gitExtension = vscode.extensions.getExtension<GitExtension>('vscode.git');
  if (!gitExtension) {
    vscode.window.showErrorMessage('Git extension not found.');
    return undefined;
  }
  return gitExtension.isActive ? gitExtension.exports : await gitExtension.activate();
}

async function getCurrentRepository(): Promise<Repository | undefined> {
  const git = (await getGitExtension())?.getAPI(1);
  if (!git) return undefined;

  // Get the first repository in the workspace.
  // TODO what to do in a multi-root workspace? I don't think we should support that yet.
  if (git.repositories.length === 0) {
    vscode.window.showInformationMessage('No Git repositories found in the current workspace.');
    return undefined;
  }
  return git.repositories[0];
}

/**
 * Represents an item in the quick pick selection list for Git references.
 * Extends VSCode's QuickPickItem with Git-specific properties.
 */
interface Item extends vscode.QuickPickItem {
  /** The full Git commit hash associated with this reference */
  commit: string;

  /**
   * The type of Git reference:
   * - 'refs/heads' for local branches
   * - 'refs/remotes' for remote branches
   * - 'refs/tags' for tags
   * - 'commit' for individual commits
   */
  type: string;
}

async function getRefs(repo: Repository): Promise<Item[]> {
  try {
    const dir = repo.rootUri.fsPath;
    const { stdout: refsOutput } = await execPromise(
      'git for-each-ref --format="%(objectname);%(if)%(HEAD)%(then)HEAD%(else)%(refname:short)%(end);%(refname:rstrip=-2);%(objectname:short) ⋅ %(creatordate:human)" --merged HEAD --sort=-creatordate',
      {
        cwd: dir,
      }
    );
    return refsOutput
      .trim()
      .split('\n')
      .map((line) => {
        const [commit, label, type, description] = line.split(';', 4);
        return { commit, label, type, description };
      });
  } catch (error) {
    console.error('Failed to get branches:', error);
    // fallback to using the Git extension API
    return (await repo.getBranches({ sort: 'committerdate' })).map((branch) => ({
      label: branch.name ?? 'Unknown Branch',
      description: branch.commit?.slice(0, 8),
      commit: branch.commit ?? '',
      type: 'refs/heads',
    }));
  }
}

async function getItems(repo: Repository): Promise<Item[]> {
  const refs = await getRefs(repo);
  const head = repo.state.HEAD?.commit;
  const nextRefIdx = refs.findIndex((ref) => ref.commit !== head);
  if (nextRefIdx !== -1)
    try {
      const { stdout: logOutput } = await execPromise(
        `git log  --format="%H;%h;%ch ⋅ %s" ${refs[nextRefIdx].commit}...HEAD`,
        {
          cwd: repo.rootUri.fsPath,
        }
      );
      const commits = logOutput
        .trim()
        .split('\n')
        .filter((line) => line.trim() !== '')
        .map((line) => {
          const [commit, label, description] = line.split(';', 3);
          return {
            label,
            description,
            commit,
            type: 'commit',
          };
        })
        .filter(({ commit }) => commit !== head);
      refs.splice(Math.max(nextRefIdx - 1, 0), 0, ...commits);
    } catch (error) {
      console.error('Failed to get commits:', error);
    }

  return refs;
}

const ICONS = {
  'refs/heads': new vscode.ThemeIcon('git-branch'),
  'refs/remotes': new vscode.ThemeIcon('cloud'),
  'refs/tags': new vscode.ThemeIcon('tag'),
};

/**
 * Common main branches that are frequently used across Git repositories.
 * These branches are given priority in the quick pick UI by showing them first
 * when no previously selected branch is available.
 *
 * The list includes:
 * - main/master: Primary development branches
 * - develop: Feature integration branch in GitFlow
 * - release/staging/testing/qa: Various pre-production environments
 * - prod: Production branch
 */
const COMMON_MAIN_BRANCHES = [
  'main',
  'master',
  'develop',
  'release',
  'staging',
  'testing',
  'qa',
  'prod',
];
const COMMON_MAIN_BRANCH_ICONS = {
  main: new vscode.ThemeIcon('check'),
  master: new vscode.ThemeIcon('check'),
  develop: new vscode.ThemeIcon('sync'),
  release: new vscode.ThemeIcon('rocket'),
  staging: new vscode.ThemeIcon('play'),
  testing: new vscode.ThemeIcon('beaker'),
  qa: new vscode.ThemeIcon('shield'),
  prod: new vscode.ThemeIcon('globe'),
};
