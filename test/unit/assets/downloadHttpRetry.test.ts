import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import chai, { expect } from 'chai';
import chaiAsPromised from 'chai-as-promised';
import chaiFs from 'chai-fs';
import Sinon from 'sinon';
import tmp from 'tmp';
import { URI } from 'vscode-uri';

import '../mock/vscode';

import downloadHttpRetry, { HttpError } from '../../../src/assets/downloadHttpRetry';

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

  // Retrying just delays the caller's fallback by the length of the backoff;
  // the answer won't be different the second time. 4xx is a refusal, and 204
  // or 304 is a success we couldn't read a body from -- repeating the request
  // can't make one appear.
  [204, 304, 400, 401, 403, 404, 407, 410].forEach((status) => {
    it(`does not retry after ${status}`, async () => {
      const download = Sinon.stub().rejects(new HttpError(status));
      const target = join(tempDir, 'file.test');

      await expect(downloadHttpRetry(source, target, download)).to.be.rejectedWith(
        `got status ${status}`
      );
      expect(download.callCount).to.equal(1);
      expect(target).to.not.be.a.path();
    });
  });

  // 408 and 429 both explicitly mean "try again", and 5xx is the server
  // failing rather than refusing.
  [408, 429, 500, 502, 503].forEach((status) => {
    it(`retries after ${status}`, async () => {
      const download = Sinon.stub().rejects(new HttpError(status));
      const target = join(tempDir, 'file.test');

      await expect(downloadHttpRetry(source, target, download)).to.be.rejected;
      expect(download.callCount).to.equal(3);
    });
  });

  it('still retries errors that carry no status, such as a dropped connection', async () => {
    const download = Sinon.stub().rejects(new Error('ECONNRESET'));
    const target = join(tempDir, 'file.test');

    await expect(downloadHttpRetry(source, target, download)).to.be.rejected;
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
