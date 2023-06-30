import assert from 'assert';
import { initializeWorkspace, waitFor, waitForExtension, withAuthenticatedUser } from '../util';

describe('AppMaps', () => {
  withAuthenticatedUser();

  beforeEach(initializeWorkspace);
  beforeEach(waitForExtension);
  afterEach(initializeWorkspace);

  it('is a three-level tree', async () => {
    const trees = (await waitForExtension()).trees;

    const appmapsTree = trees.appmaps;

    await waitFor(
      `AppMaps tree first root should be 'project-a'`,
      () =>
        appmapsTree
          .getChildren()
          .map((root) => root.name)
          .sort()
          .shift() === 'project-a'
    );
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const projectA = appmapsTree.getChildren()[0] as any;

    await waitFor(
      `'project-a' should contain one child`,
      () => appmapsTree.getChildren(projectA).length === 1
    );

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const minitest = appmapsTree.getChildren(projectA)[0] as any;

    await waitFor(
      `'minitest' should contain two children`,
      () => appmapsTree.getChildren(minitest)?.length === 2
    );

    const appmaps = appmapsTree.getChildren(minitest);
    assert(appmaps, `No appmaps for ${minitest.name}`);
    assert.deepStrictEqual(
      appmaps.map((appmap) => appmap.descriptor.metadata?.name),
      [
        'Microposts_controller can get microposts as JSON',
        'Microposts_interface micropost interface',
      ]
    );
  });
});
