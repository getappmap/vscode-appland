import * as vscode from 'vscode';
import { Dirent, promises as fs } from 'fs';
import { join } from 'path';

class AppMapDescriptor {
  public resourceUri: vscode.Uri;
  public metadata?: Record<string, unknown>;

  constructor(resourceUri: vscode.Uri, metadata?: Record<string, unknown>) {
    this.resourceUri = resourceUri;
    this.metadata = metadata;
  }

  public static async fromResource(
    resourceUri: vscode.Uri
  ): Promise<AppMapDescriptor> {
    const buf = await fs.readFile(resourceUri.fsPath);
    const appmapJson = JSON.parse(buf.toString());
    return new AppMapDescriptor(resourceUri, appmapJson.metadata);
  }
}

async function findAppMaps(dir: string): Promise<AppMapDescriptor[]> {
  const result: AppMapDescriptor[] = [];
  const files: Dirent[] = await fs.readdir(dir, { withFileTypes: true });

  await Promise.all(
    files.map(async (file) => {
      if (file.isDirectory()) {
        const appMapDescriptors = await findAppMaps(file.toString());
        appMapDescriptors.forEach((d) => result.push(d));
      } else if (file.name.match(/\.appmap\.json$/)) {
        try {
          const uri = vscode.Uri.file(join(dir, file.name));
          result.push(await AppMapDescriptor.fromResource(uri));
        } catch (e) {
          console.error(e);
        }
      }
    })
  );

  return result;
}

export class AppMapTreeDataProvider
  implements vscode.TreeDataProvider<vscode.TreeItem> {
  public getTreeItem(element: vscode.TreeItem): vscode.TreeItem {
    return element;
  }

  public getChildren(): Thenable<vscode.TreeItem[]> {
    const { workspaceFolders } = vscode.workspace;
    if (!workspaceFolders) {
      return Promise.resolve([]);
    }

    const listItemPromises = workspaceFolders.flatMap(async (dir) => {
      const appMapDescriptors = await findAppMaps(dir.uri.fsPath);
      return appMapDescriptors
        .map((d) => ({
          label: d.metadata?.name as string,
          tooltip: d.metadata?.name as string,
          command: {
            title: 'open',
            command: 'vscode.open',
            arguments: [d.resourceUri],
          },
        }))
        .sort((a, b) => a.label.localeCompare(b.label));
    });

    return Promise.all(listItemPromises).then((listItems) =>
      Promise.resolve(listItems.flat())
    );
  }
}
