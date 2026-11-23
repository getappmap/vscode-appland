import '../mock/vscode';
import chai, { expect } from 'chai';
import chaiAsPromised from 'chai-as-promised';
import chaiFs from 'chai-fs';
import fsPromises, {
  lstat,
  mkdir,
  mkdtemp,
  readdir,
  readlink,
  rm,
  symlink,
  writeFile,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import Sinon from 'sinon';

import { updateSymlink } from '../../../src/assets/helpers';

chai.use(chaiAsPromised);
chai.use(chaiFs);

describe('updateSymlink', () => {
  let dir: string;
  let binDir: string;
  let link: string;

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), 'vscode-appland-update-symlink-test-'));
    binDir = join(dir, 'bin');
    link = join(binDir, 'appmap');
    await mkdir(binDir);
  });

  afterEach(async () => {
    Sinon.restore();
    await rm(dir, { recursive: true });
  });

  async function asset(name: string, content: string): Promise<string> {
    const path = join(dir, name);
    await writeFile(path, content);
    return path;
  }

  it('creates a missing link', async () => {
    const target = await asset('appmap-1.0.0', 'ONE');

    await updateSymlink(target, link);

    expect(await readlink(link)).to.equal(target);
  });

  it('replaces a link to a different asset', async () => {
    const old = await asset('appmap-1.0.0', 'ONE');
    const target = await asset('appmap-2.0.0', 'TWO');
    await symlink(old, link);

    await updateSymlink(target, link);

    expect(await readlink(link)).to.equal(target);
    expect(await readdir(binDir)).to.deep.equal(['appmap']);
  });

  // Rewriting it would be harmless on its own, but every rewrite is a chance for another
  // window to spawn the tool while it's being replaced.
  it('leaves a link that is already current alone', async () => {
    const target = await asset('appmap-1.0.0', 'ONE');
    await symlink(target, link);
    const before = await lstat(link);

    await updateSymlink(target, link);

    expect((await lstat(link)).ino).to.equal(before.ino);
  });

  describe('where symlinks are not available', () => {
    beforeEach(() => {
      Sinon.stub(fsPromises, 'symlink').rejects(
        Object.assign(new Error('EPERM: operation not permitted'), { code: 'EPERM' })
      );
    });

    it('copies the asset instead', async () => {
      const target = await asset('appmap-1.0.0', 'ONE');

      await updateSymlink(target, link);

      expect((await lstat(link)).isFile()).to.be.true;
      expect(link).to.be.a.file().with.content('ONE');
    });

    it('leaves a copy of the same size alone', async () => {
      const target = await asset('appmap-1.0.0', 'ONE');
      await writeFile(link, 'ONE');
      const before = await lstat(link);

      await updateSymlink(target, link);

      expect((await lstat(link)).ino).to.equal(before.ino);
    });

    it('replaces a copy of a different size', async () => {
      const target = await asset('appmap-2.0.0', 'NEWER');
      await writeFile(link, 'OLD');

      await updateSymlink(target, link);

      expect(link).to.be.a.file().with.content('NEWER');
      expect(await readdir(binDir)).to.deep.equal(['appmap']);
    });
  });

  it('keeps the existing link when the replacement cannot be made', async () => {
    const old = await asset('appmap-1.0.0', 'ONE');
    await symlink(old, link);
    Sinon.stub(fsPromises, 'rename').rejects(new Error('EBUSY: resource busy or locked'));

    await expect(updateSymlink(join(dir, 'appmap-2.0.0'), link)).to.be.rejectedWith(/EBUSY/);

    expect(await readlink(link)).to.equal(old);
    expect(await readdir(binDir)).to.deep.equal(['appmap']);
  });
});
