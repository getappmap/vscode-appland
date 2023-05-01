import assert from 'assert';
import { initializeWorkspace, waitFor, waitForExtension, withAuthenticatedUser } from '../util';

describe('AppMaps', () => {
  withAuthenticatedUser();

  beforeEach(initializeWorkspace);
  beforeEach(waitForExtension);
  afterEach(initializeWorkspace);

  it('is a two-level tree', async () => {
    const trees = (await waitForExtension()).trees;

    const appmapsTree = trees.appmaps;

    await waitFor(
      `AppMaps tree first root should be 'minitest'`,
      () =>
        appmapsTree
          .getChildren()
          .map((root) => root.name)
          .sort()
          .shift() === 'minitest'
    );
    const minitests = appmapsTree.getChildren()[0];

    await waitFor(
      `'minitest' should contain two children`,
      () => appmapsTree.getChildren(minitests)?.length === 2
    );

    const appmaps = appmapsTree.getChildren(minitests);
    assert(appmaps, `No appmaps for ${minitests.name}`);
    assert.deepStrictEqual(
      appmaps.map((appmap) => appmap.descriptor.metadata?.name),
      [
        'Microposts_controller can get microposts as JSON',
        'Microposts_interface micropost interface',
      ]
    );
  });
});
