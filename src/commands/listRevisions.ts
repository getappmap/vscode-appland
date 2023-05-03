import * as vscode from 'vscode';
import { promisify } from 'util';
import { basename, join } from 'path';
import { glob } from 'glob';
import { exec } from 'child_process';

export type Revision = { revision: string; sortIndex?: number; decorations?: string };

export async function listRevisions(cwd: string): Promise<Revision[] | undefined> {
  const archiveFiles = await promisify(glob)(join(cwd, '.appmap/archive/full/*.tar'));
  const revisions: Revision[] = archiveFiles
    .map((file) => file.split('/').pop()!)
    .map((file) => basename(file, '.tar'))
    .map((sha) => ({ revision: sha, inHistory: false }));

  if (revisions.length === 0) {
    vscode.window.showInformationMessage(
      `No AppMap archives found in .appmap/archive/full. Use the command 'AppMap: Archive Current AppMaps' to create an archive`
    );
    return;
  }

  const loadHistory = async () => {
    try {
      return (await promisify(exec)(`git log --pretty=format:'%H %d'`, { cwd })).stdout;
    } catch (e) {
      console.debug(
        `Error loading git history for ${cwd} (this is probably not a git repository): ${e}`
      );
    }
  };

  const historyOutput = await loadHistory();
  if (historyOutput) {
    let order = 1;
    const revisionInfo = historyOutput.split('\n').reduce(
      (acc, line) => {
        const [revision, ...branch] = line.split(' ');
        if (branch.length > 0) acc.branch.set(revision, branch.join(' '));
        acc.order.set(revision, order);
        order += 1;
        return acc;
      },
      { branch: new Map<string, string>(), order: new Map<string, number>() }
    );
    revisions.forEach((revision) => {
      const branch = revisionInfo.branch.get(revision.revision);
      if (branch) {
        revision.decorations = branch;
      }
      revision.sortIndex = revisionInfo.order.get(revision.revision);
    });
  }

  return revisions;
}
