import assert from 'assert';
import { initializeWorkspace, waitForExtension } from '../util';

describe('AppMaps', () => {
  beforeEach(initializeWorkspace);
  beforeEach(waitForExtension);
  afterEach(initializeWorkspace);

  it('is a two-level tree', async () => {
    const trees = (await waitForExtension()).trees;

    const appmapsTree = trees.appmaps;
    const roots = await appmapsTree.getChildren();

    assert(roots, 'AppMaps tree is empty');
    assert.deepStrictEqual(roots.map((root) => root.label).sort(), ['minitest']);
    const minitests = roots[0];

    const appmaps = await appmapsTree.getChildren(minitests);
    assert(appmaps, `No appmaps for ${minitests.label}`);
    assert.deepStrictEqual(
      appmaps.map((appmap) => (appmap as any).descriptor.metadata.name),
      [
        'Microposts_controller can get microposts as JSON',
        'Microposts_interface micropost interface',
      ]
    );
  });
});