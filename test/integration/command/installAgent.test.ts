// @project project-ruby

import assert from 'assert';
import * as vscode from 'vscode';
import { InstallAgent } from '../../../src/commands/installAgent';
import { ProjectRuby, waitForExtension } from '../util';

describe('Install agent command', () => {
  before(async () => {
    await waitForExtension();
    vscode.commands.executeCommand(InstallAgent, ProjectRuby, 'ruby');
  });

  it('opens a terminal', () => {
    const terminals = vscode.window.terminals;
    assert.strictEqual(terminals.length, 1);
    assert.strictEqual(terminals[0].name, 'install-appmap');
  });
});
