import '../mock/vscode';

import * as vscode from 'vscode';
import assert from 'assert';
import { ProjectA } from '../testFixtures';
import {
  AppMapTerminalLink,
  AppMapTerminalLinkProvider,
} from '../../../src/terminalLink/appmapLinkProvider';
import Sinon from 'sinon';
import { join } from 'path';

describe('TerminalLink', () => {
  // bestFilePath resolves relative AppMap paths by globbing the workspace folders.
  beforeEach(() =>
    Sinon.stub(vscode.workspace, 'workspaceFolders').value([
      { uri: vscode.Uri.file(ProjectA), name: 'project-a', index: 0 },
    ])
  );
  afterEach(() => Sinon.restore());

  const firstLink = {
    startIndex: 22,
    length: 31,
    appMapFileName: '/Users/me/proj/test.appmap.json',
  } as AppMapTerminalLink;

  const secondLink = {
    startIndex: 66,
    length: 83,
    appMapFileName:
      'tmp/appmap/minitest/Microposts_controller_can_get_microposts_as_JSON.appmap.json',
    eventId: 12,
  } as AppMapTerminalLink;

  const line = [
    'Something happened at',
    firstLink.appMapFileName,
    'and also at',
    [secondLink.appMapFileName, secondLink.eventId].join(':'),
  ].join(' ');

  it('selects AppMaps from a terminal line', async () => {
    const linkProvider = new AppMapTerminalLinkProvider();
    const context = { line, terminal: {} as vscode.Terminal } as vscode.TerminalLinkContext;
    const links = linkProvider.provideTerminalLinks(context);
    assert.ok(links);
    assert.deepStrictEqual(links.length, 2);
    assert.deepStrictEqual(firstLink, JSON.parse(JSON.stringify(links[0], null, 2)));
    assert.deepStrictEqual(secondLink, JSON.parse(JSON.stringify(links[1], null, 2)));
  });

  it('opens an AppMap from a terminal link', async () => {
    const executeCommand = Sinon.stub(vscode.commands, 'executeCommand').resolves();
    const linkProvider = new AppMapTerminalLinkProvider();

    await linkProvider.handleTerminalLink(firstLink);
    await linkProvider.handleTerminalLink(secondLink);

    assert.strictEqual(executeCommand.getCalls().length, 2);

    {
      const call = executeCommand.getCalls()[0];
      assert.strictEqual(call.args[0], 'vscode.open');
      assert.strictEqual(call.args[1].scheme, 'file');
      assert.strictEqual(call.args[1].path, firstLink.appMapFileName);
      assert.deepStrictEqual(JSON.parse(call.args[1].fragment), {
        currentView: 'viewFlow',
      });
    }

    {
      const call = executeCommand.getCalls()[1];
      assert.strictEqual(call.args[0], 'vscode.open');
      assert.strictEqual(call.args[1].scheme, 'file');
      assert.strictEqual(call.args[1].path, join(ProjectA, secondLink.appMapFileName));
      assert.deepStrictEqual(JSON.parse(call.args[1].fragment), {
        currentView: 'viewFlow',
        selectedObject: `event:${secondLink.eventId}`,
      });
    }
  });
});
