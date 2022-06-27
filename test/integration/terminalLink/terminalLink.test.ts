import * as vscode from 'vscode';
import assert from 'assert';
import { closeWorkspace, initializeWorkspace, ProjectA, waitForExtension } from '../util';
import {
  AppMapTerminalLink,
  AppMapTerminalLinkProvider,
} from '../../../src/terminalLink/appmapLinkProvider';
import Sinon from 'sinon';
import { expect } from '@playwright/test';
import { join, resolve } from 'path';

describe('TerminalLink', () => {
  beforeEach(initializeWorkspace);
  beforeEach(waitForExtension);
  afterEach(closeWorkspace);

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

    expect(executeCommand.getCalls()).toHaveLength(2);

    {
      const call = executeCommand.getCalls()[0];
      expect(call.args[0]).toEqual('vscode.open');
      expect(call.args[1].scheme).toEqual('file');
      expect(call.args[1].path).toEqual(firstLink.appMapFileName);
      expect(JSON.parse(call.args[1].fragment)).toEqual({
        currentView: 'viewFlow',
      });
    }

    {
      const call = executeCommand.getCalls()[1];
      expect(call.args[0]).toEqual('vscode.open');
      expect(call.args[1].scheme).toEqual('file');
      expect(call.args[1].path).toEqual(join(ProjectA, secondLink.appMapFileName));
      expect(JSON.parse(call.args[1].fragment)).toEqual({
        currentView: 'viewFlow',
        selectedObject: `event:${secondLink.eventId}`,
      });
    }
  });
});
