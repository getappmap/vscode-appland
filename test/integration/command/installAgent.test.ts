// @project project-ruby

import assert from 'assert';
import sinon from 'sinon';
import os from 'os';
import path from 'path';
import * as vscode from 'vscode';
import { generateInstallInfo, InstallAgent } from '../../../src/commands/installAgent';
import { ProjectRuby, waitForExtension } from '../util';

describe('Install agent command', () => {
  before(async () => {
    const extension = await waitForExtension();
    await extension.commandRegistry.commandReady(InstallAgent);
    await vscode.commands.executeCommand(InstallAgent, ProjectRuby, 'Ruby');
  });

  it('opens a terminal', async () => {
    const terminals = vscode.window.terminals;
    assert.strictEqual(terminals.length, 1);
    assert(terminals[0].name.startsWith('AppMap installer'));
  });
});

describe('generateInstallInfo function', () => {
  let osStub: sinon.SinonStub;
  let pathStub: sinon.SinonStub;
  let cwd: string;
  let globalStorageDir: string;

  describe('in Windows', () => {
    before(() => {
      osStub = sinon.stub(os, 'platform').returns('win32');
      pathStub = sinon.stub(path, 'join').callsFake(path.win32.join);
    });

    after(() => {
      osStub.restore();
      pathStub.restore();
    });

    describe('with a space in the path', () => {
      before(() => {
        cwd = 'C:\\Users\\user\\projects\\directory with a space';
        globalStorageDir = 'C:\\globalStorageDir\\with spaces in path';
      });

      it('generates the correct command for a JavaScript project', () => {
        const { command, env } = generateInstallInfo(cwd, 'JavaScript', true, globalStorageDir);
        assert.deepStrictEqual(env, {});
        assert.strictEqual(
          command,
          'npx --prefer-online @appland/appmap@latest install -d C:"\\Users\\user\\projects\\directory with a space"'
        );
      });

      it('generates the correct command for a non-JavaScript project', () => {
        let { command, env } = generateInstallInfo(cwd, 'Ruby', true, globalStorageDir);
        const expected =
          'C:"\\globalStorageDir\\with spaces in path\\appmap-win-x64.exe" install ' +
          '-d C:"\\Users\\user\\projects\\directory with a space"';
        assert.deepStrictEqual(env, {});
        assert.strictEqual(command, expected);

        const pythonCommand = generateInstallInfo(cwd, 'Python', true, globalStorageDir);
        command = pythonCommand.command;
        env = pythonCommand.env;
        assert.deepStrictEqual(env, {});
        assert.strictEqual(command, expected);
      });

      it('generates the correct command when there are no CLI binaries', () => {
        let { command, env } = generateInstallInfo(cwd, 'Ruby', false, globalStorageDir);
        const expected =
          'npx --prefer-online @appland/appmap@latest install -d C:"\\Users\\user\\projects\\directory with a space"';
        assert.deepStrictEqual(env, {});
        assert.strictEqual(command, expected);

        const pythonCommand = generateInstallInfo(cwd, 'Python', false, globalStorageDir);
        command = pythonCommand.command;
        env = pythonCommand.env;
        assert.deepStrictEqual(env, {});
        assert.strictEqual(command, expected);
      });
    });

    describe('without a space in the path', () => {
      before(() => {
        cwd = 'C:\\Users\\user\\projects\\directory-without-a-space';
        globalStorageDir = 'C:\\globalStorageDir\\without-spaces-in-path';
      });

      it('generates the correct command for a JavaScript project', () => {
        const { command, env } = generateInstallInfo(cwd, 'JavaScript', true, globalStorageDir);
        assert.deepStrictEqual(env, {});
        assert.strictEqual(
          command,
          'npx --prefer-online @appland/appmap@latest install -d C:"\\Users\\user\\projects\\directory-without-a-space"'
        );
      });

      it('generates the correct command for a non-JavaScript project', () => {
        let { command, env } = generateInstallInfo(cwd, 'Ruby', true, globalStorageDir);
        const expected =
          'C:"\\globalStorageDir\\without-spaces-in-path\\appmap-win-x64.exe" install ' +
          '-d C:"\\Users\\user\\projects\\directory-without-a-space"';
        assert.deepStrictEqual(env, {});
        assert.strictEqual(command, expected);

        const pythonCommand = generateInstallInfo(cwd, 'Python', true, globalStorageDir);
        command = pythonCommand.command;
        env = pythonCommand.env;
        assert.deepStrictEqual(env, {});
        assert.strictEqual(command, expected);
      });

      it('generates the correct command when there are no CLI binaries', () => {
        let { command, env } = generateInstallInfo(cwd, 'Ruby', false, globalStorageDir);
        const expected =
          'npx --prefer-online @appland/appmap@latest install -d C:"\\Users\\user\\projects\\directory-without-a-space"';
        assert.deepStrictEqual(env, {});
        assert.strictEqual(command, expected);

        const pythonCommand = generateInstallInfo(cwd, 'Python', false, globalStorageDir);
        command = pythonCommand.command;
        env = pythonCommand.env;
        assert.deepStrictEqual(env, {});
        assert.strictEqual(command, expected);
      });
    });
  });

  describe('in Unix', () => {
    before(() => {
      osStub = sinon.stub(os, 'platform').returns('linux');
    });

    after(() => {
      osStub.restore();
    });

    describe('with a space in the path', () => {
      const expectedBin = 'code';

      before(() => {
        cwd = '/home/user/projects/directory with spaces';
        globalStorageDir = '/home/user/.config/Code/user folder/globalStorage';
      });

      it('generates the correct command for a JavaScript project', () => {
        const { command, env } = generateInstallInfo(cwd, 'JavaScript', false, globalStorageDir);
        assert.deepStrictEqual(env, {});
        assert.strictEqual(
          command,
          'npx --prefer-online @appland/appmap@latest install -d /home/user/projects/directory\\ with\\ spaces'
        );
      });

      it('generates the correct command for non-JavaScript projects', () => {
        let { command, env } = generateInstallInfo(cwd, 'Ruby', false, globalStorageDir);
        const expectedStart = 'ELECTRON_RUN_AS_NODE=true';
        const expectedEnd =
          '/home/user/.config/Code/user\\ folder/globalStorage/node_modules/@appland/appmap/built/cli.js install ' +
          '-d /home/user/projects/directory\\ with\\ spaces';
        assert.deepStrictEqual(env, { ELECTRON_RUN_AS_NODE: 'true' });
        assert(command.startsWith(expectedStart));
        assert(command.includes(expectedEnd));
        assert(command.includes(expectedBin));

        const pythonCommand = generateInstallInfo(cwd, 'Python', false, globalStorageDir);
        command = pythonCommand.command;
        env = pythonCommand.env;
        assert.deepStrictEqual(env, { ELECTRON_RUN_AS_NODE: 'true' });
        assert(command.startsWith(expectedStart));
        assert(command.includes(expectedEnd));
        assert(command.includes(expectedBin));
      });
    });

    describe('without a space in the path', () => {
      before(() => {
        cwd = '/home/user/projects/directory-without-spaces';
        globalStorageDir = '/home/user/.config/Code/folder/globalStorage';
      });

      it('generates the correct command for a JavaScript project', () => {
        const { command, env } = generateInstallInfo(cwd, 'JavaScript', false, globalStorageDir);
        assert.deepStrictEqual(env, {});
        assert.strictEqual(
          command,
          'npx --prefer-online @appland/appmap@latest install -d /home/user/projects/directory-without-spaces'
        );
      });

      it('generates the correct command for non-JavaScript projects', () => {
        let { command, env } = generateInstallInfo(cwd, 'Ruby', false, globalStorageDir);
        const expectedStart = 'ELECTRON_RUN_AS_NODE=true';
        const expectedEnd =
          '/home/user/.config/Code/folder/globalStorage/node_modules/@appland/appmap/built/cli.js install ' +
          '-d /home/user/projects/directory-without-spaces';
        assert.deepStrictEqual(env, { ELECTRON_RUN_AS_NODE: 'true' });
        assert(command.startsWith(expectedStart));
        assert(command.includes(expectedEnd));

        const pythonCommand = generateInstallInfo(cwd, 'Python', false, globalStorageDir);
        command = pythonCommand.command;
        env = pythonCommand.env;
        assert.deepStrictEqual(env, { ELECTRON_RUN_AS_NODE: 'true' });
        assert(command.startsWith(expectedStart));
        assert(command.includes(expectedEnd));
      });
    });
  });
});
