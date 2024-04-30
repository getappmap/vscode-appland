import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import chai, { expect } from 'chai';
import chaiAsPromised from 'chai-as-promised';
import chaiFs from 'chai-fs';
import Sinon from 'sinon';
import tmp from 'tmp';
import { URI } from 'vscode-uri';

import '../mock/vscode';

import downloadHttpRetry from '../../../src/assets/downloadHttpRetry';

describe('downloadHttpRetry', () => {
  it('should retry downloads', async () => {
    const download = Sinon.stub().callsFake(async (_uri, target) => {
      await writeFile(target, 'partial test file contents');
      throw new Error('download error');
    });
    download.onSecondCall().callsFake(async (_uri, target) => {
      await writeFile(target, 'full test file contents');
    });

    const target = join(tempDir, 'file.test');

    await expect(downloadHttpRetry(source, target, download)).to.be.fulfilled;
    expect(target).to.be.a.path();
    expect(download.callCount).to.equal(2);
  });

  it('should not retry downloads if max retries exceeded', async () => {
    const download = Sinon.stub().callsFake(async (_uri, target) => {
      await writeFile(target, 'partial test file contents');
      throw new Error('download error');
    });

    const target = join(tempDir, 'file.test');

    await expect(downloadHttpRetry(source, target, download)).to.be.rejected;
    expect(target).to.not.be.a.path();
    expect(download.callCount).to.equal(3);
  });

  let tempDir: string;

  beforeEach(() => {
    tempDir = tmp.dirSync({ unsafeCleanup: true, postfix: 'appmap-vscode' }).name;
    downloadHttpRetry.retryDelay = 0;
  });

  afterEach(() => {
    Sinon.restore();
    downloadHttpRetry.retryDelay = 5;
  });

  const source = URI.parse('http://test/file.test');
});

tmp.setGracefulCleanup();
chai.use(chaiAsPromised);
chai.use(chaiFs);
