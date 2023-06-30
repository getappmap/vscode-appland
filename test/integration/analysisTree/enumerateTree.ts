import * as vscode from 'vscode';

export type CompactTreeItem = {
  label: string;
  children: CompactTreeItem[];
};

export default async function enumerateTree(
  tree: vscode.TreeDataProvider<vscode.TreeItem>,
  parent?: vscode.TreeItem
): Promise<CompactTreeItem[]> {
  const treeItems = await tree.getChildren(parent);
  if (!treeItems) return [];

  const items: CompactTreeItem[] = [];
  for (const item of treeItems) {
    let label = item.label?.toString() || 'unlabeled';

    // We don't want to try and match long FS paths. Having the last
    // part of the path matching is enough.
    const tokens = label.split('/');
    if (tokens.length > 1) label = tokens[tokens.length - 1];

    items.push({ label, children: await enumerateTree(tree, item) });
  }
  return items;
}
