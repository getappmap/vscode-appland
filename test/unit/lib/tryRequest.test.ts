import '../mock/vscode';

import { expect } from 'chai';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

import tryRequest from '../../../src/lib/tryRequest';

describe('tryRequest', () => {
  describe('file:// URLs', () => {
    let tmpDir: string;
    let tmpFile: string;

    beforeEach(async () => {
      tmpDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'tryRequest-test-'));
      tmpFile = path.join(tmpDir, 'config.json');
      await fs.promises.writeFile(tmpFile, JSON.stringify({ 'appMap.navie.rpcPort': 3000 }));
    });

    afterEach(async () => {
      await fs.promises.rm(tmpDir, { recursive: true });
    });

    it('returns ok:true and correct content via .json()', async () => {
      const result = await tryRequest(`file://${tmpFile}`);
      expect(result).to.exist;
      expect(result?.ok).to.be.true;
      const json = await result?.json();
      expect(json).to.deep.equal({ 'appMap.navie.rpcPort': 3000 });
    });

    it('returns correct content via .text()', async () => {
      const result = await tryRequest(`file://${tmpFile}`);
      expect(result).to.exist;
      const text = await result?.text();
      expect(text).to.include('navie.rpcPort');
    });

    it('returns undefined for a non-existent path', async () => {
      const result = await tryRequest(`file://${tmpDir}/nonexistent.json`);
      expect(result).to.be.undefined;
    });
  });
});
