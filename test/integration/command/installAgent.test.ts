// @project project-ruby

import assert from 'assert';
import * as vscode from 'vscode';
import { InstallAgent } from '../../../src/commands/installAgent';
import { ProjectRuby, waitFor, waitForExtension } from '../util';

describe('Install agent command', () => {
  before(async () => {
    const extension = await waitForExtension();
    await waitFor('waiting for dependency installation', () => extension.processService.ready);
    vscode.commands.executeCommand(InstallAgent, ProjectRuby, 'ruby');
  });

  it('opens a terminal', async () => {
    const terminals = vscode.window.terminals;
    assert.strictEqual(terminals.length, 1);
    assert.strictEqual(terminals[0].name, 'install-appmap');
  });
});
