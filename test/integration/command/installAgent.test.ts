// @project project-ruby

import assert from 'assert';
import * as vscode from 'vscode';
import { InstallAgent } from '../../../src/commands/installAgent';
import { ProjectRuby, waitForExtension } from '../util';

describe('Install agent command', () => {
  before(async () => {
    const { commandRegistry } = await waitForExtension();
    await commandRegistry.commandReady(InstallAgent);
  });

  it('opens a terminal', async () => {
    await vscode.commands.executeCommand(InstallAgent, ProjectRuby, 'Ruby');
    const terminals = vscode.window.terminals;

    assert.strictEqual(terminals.length, 1);
    assert(terminals[0].name.startsWith('AppMap installer'));
  });
});
