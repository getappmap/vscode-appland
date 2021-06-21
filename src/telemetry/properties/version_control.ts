import { Extension, extensions, Uri } from 'vscode';
import { Repository, GitExtension } from '../../../types/git';
import { PathLike, promises as fsPromises } from 'fs';
import { relative } from 'path';
import { createHash } from 'crypto';

export interface VersionControlProperties {
  'appmap.version_control.is_ignored': boolean | undefined;
  'appmap.version_control.is_tracked': boolean | undefined;
  'appmap.version_control.repository_id': string | undefined;
  'appmap.version_control.repository_type': string;
}

async function getGitRepoAPI(file: Uri): Promise<Repository | null | undefined> {
  try {
    const extension = extensions.getExtension('vscode.git') as Extension<GitExtension>;

    if (extension !== undefined) {
      const gitExtension = extension.isActive ? extension.exports : await extension.activate();

      console.log(file.fsPath);

      return gitExtension.getAPI(1).getRepository(file);
    }
  } catch {
    return undefined;
  }
}

function getRepoID(repo: Repository): string | undefined {
  if (repo.state.remotes.length == 0) return undefined;

  const remote = repo.state.remotes[0];
  const hash = createHash('sha256');

  const fetchUrl = remote.fetchUrl;
  if (fetchUrl === undefined) return undefined;

  hash.update(fetchUrl);
  return hash.digest('hex');
}

async function getTrackedStatus(repo: Repository, filePath: string): Promise<boolean> {
  const relPath = relative(repo.rootUri.fsPath, filePath);

  try {
    return !!(await repo.getObjectDetails('HEAD', relPath));
  } catch {
    return false;
  }
}

async function getIgnoredStatus(repo: Repository, filePath: string): Promise<boolean> {
  try {
    // Diving into the private API for a bit
    const ignoreList = (await repo['_repository'].checkIgnore([filePath])) as Set<string>;
    return ignoreList.has(filePath);
  } catch {
    return false;
  }
}

export async function getVersionControlProperties(
  file: PathLike
): Promise<VersionControlProperties> {
  const properties: VersionControlProperties = {
    'appmap.version_control.is_ignored': undefined,
    'appmap.version_control.is_tracked': undefined,
    'appmap.version_control.repository_id': undefined,
    'appmap.version_control.repository_type': 'unknown',
  };

  const filePath = await fsPromises.realpath(file);

  const repository = await getGitRepoAPI(Uri.file(filePath));
  if (repository === undefined || repository === null) return properties;

  properties['appmap.version_control.repository_type'] = 'git';
  properties['appmap.version_control.repository_id'] = getRepoID(repository);
  properties['appmap.version_control.is_tracked'] = await getTrackedStatus(repository, filePath);
  properties['appmap.version_control.is_ignored'] = await getIgnoredStatus(repository, filePath);

  return properties;
}
