import '../mock/vscode';
import sinon from 'sinon';
import os from 'os';
import path from 'path';
import { getInstallCommand } from '../../../src/commands/installAgent';
import { expect } from 'chai';

describe('installAgent', () => {
  describe('getInstallCommand', () => {
    describe('in Windows', () => {
      const homeDir = 'C:\\Users\\Default';
      const binPath = `${homeDir}\\.appmap\\bin\\appmap`;

      before(() => {
        sinon.stub(os, 'platform').returns('win32');
        sinon.stub(path, 'join').callsFake(path.win32.join);
        sinon.stub(os, 'homedir').returns(homeDir);
      });

      after(() => {
        sinon.restore();
      });

      it('generates the correct command with a space in the path', () => {
        expect(getInstallCommand('C:\\Users\\user\\projects\\directory with a space')).to.equal(
          `${binPath} install -d C:"\\Users\\user\\projects\\directory with a space"`
        );
      });

      it('generates the correct command without a space in the path', () => {
        expect(getInstallCommand('C:\\Users\\user\\projects\\directory-without-a-space')).to.equal(
          `${binPath} install -d C:"\\Users\\user\\projects\\directory-without-a-space"`
        );
      });
    });

    describe('in Unix', () => {
      const homeDir = '/home/user';
      const binPath = `${homeDir}/.appmap/bin/appmap`;

      before(() => {
        sinon.stub(os, 'platform').returns('linux');
        sinon.stub(os, 'homedir').returns(homeDir);
      });

      after(() => {
        sinon.restore();
      });

      it('generates the correct command with a space in the path', () => {
        expect(getInstallCommand('/home/user/projects/directory with spaces')).to.equal(
          `${binPath} install -d /home/user/projects/directory\\ with\\ spaces`
        );
      });

      it('generates the correct command without a space in the path', () => {
        expect(getInstallCommand('/home/user/projects/directory-without-spaces')).to.equal(
          `${binPath} install -d /home/user/projects/directory-without-spaces`
        );
      });
    });
  });
});
