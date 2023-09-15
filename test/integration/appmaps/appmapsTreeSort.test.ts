// @project project-java
import assert from 'assert';
import { initializeWorkspace, waitFor, waitForExtension, withAuthenticatedUser } from '../util';

describe('AppMaps', () => {
  withAuthenticatedUser();

  beforeEach(initializeWorkspace);
  beforeEach(waitForExtension);
  afterEach(initializeWorkspace);

  it('java requests are sorted by timestamps', async () => {
    const trees = (await waitForExtension()).trees;

    const appmapsTree = trees.appmaps;

    await waitFor(
      `AppMaps tree first root should be 'project-java'`,
      () =>
        appmapsTree
          .getChildren()
          .map((root) => root.name)
          .sort()
          .shift() === 'project-java'
    );
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const projectJava = appmapsTree.getChildren()[0] as any;

    await waitFor(
      `'project-java' should contain one child`,
      () => appmapsTree.getChildren(projectJava).length === 1
    );

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const requestFolder = appmapsTree.getChildren(projectJava)[0] as any;

    await waitFor(
      `'Request (java + request_recording)' should contain three children`,
      () => appmapsTree.getChildren(requestFolder)?.length === 3
    );

    let appmaps = appmapsTree.getChildren(requestFolder);
    // Since timestamps reflect the file modification time we manually set
    // timestamps here to assert that the sort is done by timestamps.
    // See: AppMapCollectionFile.collectAppMapDescriptor
    const b = appmaps.find((a) => a.descriptor.metadata?.name?.startsWith('GET /bups'));
    const v = appmaps.find((a) => a.descriptor.metadata?.name?.startsWith('GET /vets'));
    const o = appmaps.find((a) => a.descriptor.metadata?.name?.startsWith('GET /oups'));
    if (b) b.descriptor.timestamp = 1530;
    if (v) v.descriptor.timestamp = 1527;
    if (o) o.descriptor.timestamp = 1522;
    // getChildren should sort them by timestamp
    appmaps = appmapsTree.getChildren(requestFolder);

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
