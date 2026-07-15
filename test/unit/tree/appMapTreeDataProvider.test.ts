import '../mock/vscode';

import assert from 'assert';
import { readFileSync } from 'fs';
import { glob } from 'glob';
import sinon from 'sinon';
import * as vscode from 'vscode';

import { AppMapTreeDataProvider } from '../../../src/tree/appMapTreeDataProvider';
import MockAppMapCollection from '../../mocks/mockAppMapCollection';
import MockAppMapLoader from '../../mocks/mockAppMapLoader';
import { ProjectA, ProjectJava } from '../testFixtures';

// Replaces the appmapsTree / appmapsTreeSort integration tests. Those booted Electron
// with an authenticated user so the indexer would populate the AppMap collection, then
// polled the tree. But AppMapTreeDataProvider only shapes/sorts descriptors, so we can
// feed it AppMap loaders built straight from the committed .appmap.json metadata — no
// Electron, indexer, auth, or watcher.

class Collection extends MockAppMapCollection {
  constructor(private readonly loaders: MockAppMapLoader[]) {
    super();
  }
  allAppMaps() {
    return this.loaders;
  }
  appMaps() {
    return this.loaders;
  }
}

function loadCollection(workspaceDir: string): Collection {
  const loaders = glob
    .sync('**/*.appmap.json', { cwd: workspaceDir, absolute: true })
    .map((file) => {
      const { metadata } = JSON.parse(readFileSync(file, 'utf8'));
      return new MockAppMapLoader({ resourceUri: vscode.Uri.file(file), metadata });
    });
  return new Collection(loaders);
}

describe('AppMapTreeDataProvider', () => {
  afterEach(() => sinon.restore());

  function useWorkspace(dir: string, name: string) {
    sinon
      .stub(vscode.workspace, 'workspaceFolders')
      .value([{ uri: vscode.Uri.file(dir), name, index: 0 }]);
  }

  it('is a three-level tree (project -> recorder folder -> appmaps)', () => {
    useWorkspace(ProjectA, 'project-a');
    const provider = new AppMapTreeDataProvider(loadCollection(ProjectA));

    const roots = provider.getChildren();
    assert.deepStrictEqual(
      roots.map((root) => root.name),
      ['project-a']
    );

    const folders = provider.getChildren(roots[0]);
    assert.strictEqual(folders.length, 1);

    const appmaps = provider.getChildren(folders[0]);
    assert.deepStrictEqual(
      appmaps.map((appmap) => appmap.descriptor.metadata?.name),
      [
        'Microposts_controller can get microposts as JSON',
        'Microposts_interface micropost interface',
      ]
    );
  });

  it('sorts java requests by timestamp', () => {
    useWorkspace(ProjectJava, 'project-java');
    const provider = new AppMapTreeDataProvider(loadCollection(ProjectJava));

    const roots = provider.getChildren();
    assert.deepStrictEqual(
      roots.map((root) => root.name),
      ['project-java']
    );

    const folders = provider.getChildren(roots[0]);
    assert.strictEqual(folders.length, 1);

    const requestFolder = folders[0];
    let appmaps = provider.getChildren(requestFolder);
    assert.strictEqual(appmaps.length, 3);

    // Timestamps reflect file mtime; set them explicitly to assert the sort is by timestamp.
    // See AppMapCollectionFile.collectAppMapDescriptor / AppMapTreeDataProvider.sortByTimestamp.
    const b = appmaps.find((a) => a.descriptor.metadata?.name?.startsWith('GET /bups'));
    const v = appmaps.find((a) => a.descriptor.metadata?.name?.startsWith('GET /vets'));
    const o = appmaps.find((a) => a.descriptor.metadata?.name?.startsWith('GET /oups'));
    if (b) b.descriptor.timestamp = 1530;
    if (v) v.descriptor.timestamp = 1527;
    if (o) o.descriptor.timestamp = 1522;

    appmaps = provider.getChildren(requestFolder);
    assert.deepStrictEqual(
      appmaps.map((appmap) => appmap.descriptor.metadata?.name),
      [
        'GET /bups (500) - 15:30:47.872',
        'GET /vets.html (200) - 15:27:11.736',
        'GET /oups (500) - 15:22:47.872',
      ]
    );
  });
});
