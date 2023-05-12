import * as vscode from 'vscode';
import assert from 'assert';
import { Revision } from './listRevisions';

export interface RevisionItem extends vscode.QuickPickItem {
  revision?: Revision;
}

export default async function chooseRevision(
  revisions: Revision[],
  prompt: string,
  exclude: string[] = []
): Promise<string | undefined> {
  assert(revisions);
  const options: vscode.QuickPickOptions = {
    canPickMany: false,
    placeHolder: prompt,
  };

  const unsortedItems = revisions.map((revision) => ({
    revision: revision,
    label: [revision.revision, revision.decorations].filter(Boolean).join(' '),
  }));

  const items: RevisionItem[] = unsortedItems.filter((item) => item.revision.sortIndex);
  items.sort((a, b) => a.revision?.sortIndex! - b.revision?.sortIndex!);
  items.push({ label: '---' });
  items.push(...unsortedItems.filter((item) => !item.revision.sortIndex));

  const avaliableRevisions = items.filter(
    (rev) => !rev.revision?.revision || !exclude.includes(rev.revision.revision)
  );

  const revisionItem = await vscode.window.showQuickPick(avaliableRevisions, options);

  return revisionItem?.revision?.revision;
}
