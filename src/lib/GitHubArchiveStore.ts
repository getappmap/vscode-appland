/* eslint-disable @typescript-eslint/no-non-null-assertion */
import { glob } from 'glob';
import { basename, dirname, join } from 'path';
import { promisify } from 'util';
import { Octokit } from '@octokit/rest';
import { mkdtemp, rm, unlink } from 'fs/promises';
import { createWriteStream } from 'fs';
import { tmpdir } from 'os';
import assert from 'assert';
import { get } from 'https';
import { executeCommand } from './executeCommand';

export type ArchiveId = string;

export type ArchiveEntry = {
  id: ArchiveId;
  createdAt: number;
  baseRevision: string;
  headRevision: string;
};

export class ArchiveInventory {
  constructor(
    public readonly lastUpdatedAt: number,
    public readonly entries: Map<ArchiveId, ArchiveEntry>
  ) {}

  matchRevision(revisions: string[]): ArchiveEntry | undefined {
    const headRevisions = new Set(
      [...this.entries.values()].map((revision) => revision.headRevision)
    );
    const latestMatchingRevision = revisions?.find((commit) => headRevisions.has(commit));
    if (!latestMatchingRevision) return;

    return [...this.entries.values()].find(
      (revision) => revision.headRevision === latestMatchingRevision
    );
  }

  static changeReportDirFromArchiveFileName(archiveFile: string) {
    const archiveDir = dirname(archiveFile);
    const compareName = basename(archiveDir);
    return join('.appmap', 'change-report', compareName);
  }

  static changeReportDirFromArchiveEntry(archiveEntry: ArchiveEntry) {
    return join(
      '.appmap',
      'change-report',
      [archiveEntry.baseRevision, archiveEntry.headRevision].join('-')
    );
  }
}

export class GitHubArchiveStore {
  constructor(
    public readonly octokit: Octokit,
    public readonly owner: string,
    public readonly repo: string
  ) {}

  async revisionsAvailable(prefix: string, since?: number): Promise<ArchiveInventory> {
    const { owner, repo } = this;
    const result = new Map<ArchiveId, ArchiveEntry>();
    // eslint-disable-next-line no-constant-condition
    let lastUpdatedAt = 0;
    for (let page = 1; true; page++) {
      const response = (
        await this.octokit.rest.actions.listArtifactsForRepo({
          owner,
          repo,
          page,
          per_page: 100,
        })
      ).data;
      if (response.artifacts.length === 0) break;

      for (const artifact of response.artifacts) {
        // TODO: Use id or node_id?
        const { id, name, created_at: createdAtStr } = artifact;
        if (!createdAtStr) continue;

        const createdAt = new Date(createdAtStr).getTime();
        if (since && createdAt < since) continue;

        if (createdAt > lastUpdatedAt) lastUpdatedAt = createdAt;

        // Example archive name: appmap-preflight_2c51afaae3cc355e4bac499e9b68ea1d3dc1b36a.tar
        // Extract archive type and revision from the name
        const matchResult = new RegExp(`${prefix}-(\\w+)-(\\w+)\\.tar`).exec(name);
        if (!matchResult) continue;

        const baseRevision = matchResult[1];
        const headRevision = matchResult[2];
        result.set(id.toString(), {
          id: id.toString(),
          createdAt,
          baseRevision,
          headRevision,
        });
      }
    }
    return new ArchiveInventory(lastUpdatedAt, result);
  }

  async fetch(archiveId: string): Promise<string> {
    const { owner, repo } = this;
    const { url: artifactUrl } = await this.octokit.rest.actions.downloadArtifact({
      owner,
      repo,
      artifact_id: parseInt(archiveId, 10),
      archive_format: 'zip',
    });
    assert(artifactUrl, `No location header in response for artifact ${archiveId}`);

    const tempDir = await mkdtemp(join(tmpdir(), 'vscode-appmap-'));
    process.on('exit', () => rm(tempDir, { recursive: true, force: true }));

    const tempFile = join(tempDir, 'archive.zip');
    await downloadFile(new URL(artifactUrl), tempFile);
    await executeCommand(`unzip -o -d ${tempDir} ${tempFile}`);
    const filesAvailable = await promisify(glob)([tempDir, '**', '*.tar.gz'].join('/'), {
      dot: true,
    });
    if (filesAvailable.length === 0)
      throw new Error(`No *.tar.gz found in GitHub artifact ${archiveId}`);
    if (filesAvailable.length > 1)
      throw new Error(`Multiple *.tar.gz found in GitHub artifact ${archiveId}`);
    return filesAvailable.pop()!;
  }
}

export async function downloadFile(url: URL, path: string) {
  const file = createWriteStream(path);
  return new Promise<void>((resolve, reject) => {
    get(url, function (response) {
      response.pipe(file);
      file.on('finish', () => {
        file.close();
        resolve();
      });
    }).on('error', function (err) {
      unlink(path);
      reject(err);
    });
  });
}
