// @project project-python

import assert from 'assert';
import * as vscode from 'vscode';
import PythonInstaller from '../../../../src/commands/installer/python';
import { waitFor, waitForExtension } from '../../util';
import { join } from 'path';
import * as sinon from 'sinon';
import { retry } from '../../../../src/util';
import projectRootDirectory from 'project-root-directory';
import type { IExtensionApi as PythonExtension } from '../../../../types/ms-python';

describe('Install agent command', () => {
  // This isn't recreated for each test case because it should be stateless
  const installer = new PythonInstaller();
  const projectPath = join(
    projectRootDirectory,
    'test',
    'fixtures',
    'workspaces',
    'project-python'
  );
  let pythonExtension: vscode.Extension<PythonExtension>;

  before(async () => {
    const extension = await waitForExtension();
    await waitFor('waiting for dependency installation', () => extension.processService.ready);

    vscode.commands.executeCommand(
      'workbench.extensions.installExtension',
      PythonInstaller.PythonExtensionId
    );

    await retry(
      async () => {
        pythonExtension = vscode.extensions.all.find(
          (e) => e.id === PythonInstaller.PythonExtensionId
        ) as vscode.Extension<PythonExtension>;

        if (!pythonExtension) throw new Error('Python extension not found');

        await pythonExtension.activate();
        await pythonExtension.exports.ready;
      },
      30,
      1000
    );
  });

  afterEach(() => {
    sinon.restore();
  });

  after(() => {
    vscode.commands.executeCommand('workbench.extensions.uninstallExtension', 'ms-python.python');
  });

  it('detects it can install the agent', async () => {
    assert(await installer.canInstall('Python'));
  });

  it('aborts installation without the python extension', async () => {
    sinon.stub(vscode.window, 'showInformationMessage').resolves('No' as any); // eslint-disable-line @typescript-eslint/no-explicit-any
    sinon.stub(PythonInstaller.prototype, 'pythonExtensionLoader').value(undefined);
    const withActiveEnvironment = sinon.stub(PythonInstaller, 'withActiveEnvironment').resolves();

    await installer.execute('', projectPath);

    assert(withActiveEnvironment.notCalled);
  });

  it('opens a terminal to install the AppMap agent', async () => {
    retry(
      () => {
        const activeTerminal = vscode.window.activeTerminal;
        if (!activeTerminal) throw new Error('No active terminal');
        if (!activeTerminal.name.startsWith('AppMap installer'))
          throw new Error('The active terminal is not the install-appmap terminal');
      },
      60,
      500
    );
  });

  it('overrides the python.terminal.activateEnvironment setting', async () => {
    const update = sinon.stub().resolves();
    sinon.stub(vscode.workspace, 'getConfiguration').returns({
      get: sinon.stub().withArgs(PythonInstaller.PythonConfigActivate).returns(false),
      inspect: sinon.stub().withArgs(PythonInstaller.PythonConfigActivate).returns({
        workspaceFolderValue: false,
      }),
      update,
    } as any); // eslint-disable-line @typescript-eslint/no-explicit-any

    await PythonInstaller.withActiveEnvironment(() => Promise.resolve());

    assert.equal(update.callCount, 2);
    assert(
      update.firstCall.calledWith(
        PythonInstaller.PythonConfigActivate,
        true,
        vscode.ConfigurationTarget.WorkspaceFolder
      )
    );
    assert(
      update.secondCall.calledWith(
        PythonInstaller.PythonConfigActivate,
        false,
        vscode.ConfigurationTarget.WorkspaceFolder
      )
    );
  });
});
