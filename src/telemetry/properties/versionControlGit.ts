import { Extension, extensions, Uri, default as vscode } from 'vscode';
import { Repository, GitExtension } from '../../../types/git';
import { PathLike, promises as fs } from 'fs';
import path from 'path';
import { createHash } from 'crypto';
import { default as ignore, Ignore } from 'ignore';
import VersionControlProperties from './versionControl';

async function ignoresForWorkspaceFolder(wsFolder: string): Promise<Ignore> {
  const directories: Array<string> = [wsFolder];
  const wsIgnore: Ignore = ignore();

  for (;;) {
    const currentDirectory = directories.pop() as string;
    if (!currentDirectory) {
      break;
    }

    const files = await fs.readdir(currentDirectory, { withFileTypes: true });
    const gitIgnore = files.find((file) => file.isFile() && file.name === '.gitignore');
    if (gitIgnore) {
      wsIgnore.add((await fs.readFile(path.join(currentDirectory, gitIgnore.name))).toString());
    }

    files.filter((file) => {
      if (!file.isDirectory()) {
        return false;
      }

      const fullPath = path.join(currentDirectory, file.name);
      if (!wsIgnore.ignores(file.name)) {
        directories.push(fullPath);
      }
    });
  }

  return wsIgnore;
}
export default class GitProperties implements VersionControlProperties {
  private static ignores: Record<string, Ignore> | null = null;

  private static async getGitRepoAPI(file: Uri): Promise<Repository | null | undefined> {
    try {
      const extension = extensions.getExtension('vscode.git') as Extension<GitExtension>;

      if (extension !== undefined) {
        const gitExtension = extension.isActive ? extension.exports : await extension.activate();
        return gitExtension.getAPI(1).getRepository(file);
      }
    } catch {
      return undefined;
    }
  }

  public static async isIgnored(filePath: PathLike): Promise<boolean> {
    if (!this.ignores) {
      this.ignores = {};
      const { workspaceFolders } = vscode.workspace;
      if (workspaceFolders) {
        for (const wsFolder of workspaceFolders) {
          const path = wsFolder.uri.fsPath;
          this.ignores[path] = await ignoresForWorkspaceFolder(path);
        }
      }
    }

    const rootFolder = path.parse(filePath as string).root;

    let filename = path.basename(filePath as string);
    let dirname = path.dirname(filePath as string);

    for (;;) {
      if (this.ignores && this.ignores[dirname] && this.ignores[dirname]?.ignores(filename)) {
        return true;
      }

      if (dirname !== rootFolder) {
        filename = path.join(path.basename(dirname), filename);
        dirname = path.dirname(dirname);
      } else {
        break;
      }
    }

    return false;
  }

  public static async isTracked(filePath: PathLike): Promise<boolean | undefined> {
    const repository = await this.getGitRepoAPI(Uri.file(filePath as string));
    if (repository === undefined || repository === null) {
      return undefined;
    }

    const relPath = path.relative(repository.rootUri.fsPath, filePath as string);

    try {
      return !!(await repository.getObjectDetails('HEAD', relPath));
    } catch {
      return false;
    }
  }

  public static async repositoryId(filePath: PathLike): Promise<string | undefined> {
    const repository = await this.getGitRepoAPI(Uri.file(filePath as string));
    if (repository === undefined || repository === null || repository.state.remotes.length == 0) {
      return undefined;
    }

    const remote = repository.state.remotes[0];
    const hash = createHash('sha256');

    const fetchUrl = remote.fetchUrl;
    if (fetchUrl === undefined) {
      return undefined;
    }

    hash.update(fetchUrl);
    return hash.digest('hex');
  }
}
