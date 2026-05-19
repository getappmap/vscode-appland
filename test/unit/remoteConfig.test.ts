import './mock/vscode';

import { expect } from 'chai';
import Sinon from 'sinon';
import * as vscode from 'vscode';
import nock from 'nock';

import RemoteConfig, { getConfigUrl } from '../../src/configuration/remoteConfig';
import setConfigurationUrl from '../../src/commands/setConfigurationUrl';
import MockExtensionContext from '../mocks/mockExtensionContext';
import { getOutputChannelLines } from './mock/vscode/window';
import { resetConfigurations } from './mock/vscode/workspace';

describe('remoteConfig', () => {
  let context: MockExtensionContext;
  let channel: vscode.OutputChannel;
  let lines: string[];

  beforeEach(() => {
    context = new MockExtensionContext();
    channel = vscode.window.createOutputChannel('AppMap: Organization Config');
    lines = getOutputChannelLines(channel);
    delete process.env.APPMAP_CONFIG_URL;
  });

  afterEach(() => {
    Sinon.restore();
    nock.cleanAll();
    context.dispose();
    resetConfigurations();
  });

  describe('getConfigUrl()', () => {
    it('returns the setting value and source when set to a non-empty string', () => {
      vscode.workspace
        .getConfiguration('appMap')
        .update('configurationUrl', 'https://example.com/config.json');
      expect(getConfigUrl()).to.deep.equal({
        url: 'https://example.com/config.json',
        source: 'setting',
      });
    });

    it('returns the env var and source when the setting is absent', () => {
      process.env.APPMAP_CONFIG_URL = 'https://env.example.com/config.json';
      expect(getConfigUrl()).to.deep.equal({
        url: 'https://env.example.com/config.json',
        source: 'env var',
      });
    });

    it('returns the env var when the setting is an empty string', () => {
      vscode.workspace.getConfiguration('appMap').update('configurationUrl', '');
      process.env.APPMAP_CONFIG_URL = 'https://env.example.com/config.json';
      expect(getConfigUrl()?.url).to.equal('https://env.example.com/config.json');
    });

    it('returns undefined when both are absent', () => {
      expect(getConfigUrl()).to.be.undefined;
    });
  });

  describe('apply() — no active URL', () => {
    it('does nothing when there are no previously applied keys', async () => {
      await RemoteConfig.apply(context, channel);
      expect(vscode.workspace.getConfiguration('appMap').get('navie.rpcPort')).to.be.undefined;
      expect(lines).to.have.length(0);
    });

    it('logs retained keys when globalState has a cached config', async () => {
      await context.globalState.update('remoteConfig', {
        url: 'https://example.com/old.json',
        config: { 'appMap.navie.rpcPort': 3000 },
      });

      await RemoteConfig.apply(context, channel);

      expect(lines.some((l) => l.includes('navie.rpcPort'))).to.be.true;
      expect(lines.some((l) => l.includes('Retaining'))).to.be.true;
    });

    it('does not write to VS Code config', async () => {
      await RemoteConfig.apply(context, channel);
      expect(vscode.workspace.getConfiguration('appMap').get('navie.rpcPort')).to.be.undefined;
    });

    it('does not modify globalState', async () => {
      await RemoteConfig.apply(context, channel);
      expect(context.globalState.get('remoteConfig')).to.be.undefined;
    });
  });

  describe('apply() — successful fetch via HTTP', () => {
    beforeEach(() => {
      nock('https://example.com')
        .get('/config.json')
        .reply(200, { 'appMap.navie.rpcPort': 3000, 'other.key': 'ignored' });
      vscode.workspace
        .getConfiguration('appMap')
        .update('configurationUrl', 'https://example.com/config.json');
    });

    it('applies each appMap.* key to VS Code global settings', async () => {
      await RemoteConfig.apply(context, channel);
      expect(vscode.workspace.getConfiguration('appMap').get('navie.rpcPort')).to.equal(3000);
    });

    it('skips keys not prefixed with appMap.', async () => {
      await RemoteConfig.apply(context, channel);
      expect(lines.some((l) => l.includes('other.key'))).to.be.false;
    });

    it('skips appMap.configurationUrl even if present in fetched config', async () => {
      nock.cleanAll();
      nock('https://example.com').get('/config.json').reply(200, {
        'appMap.navie.rpcPort': 3000,
        'appMap.configurationUrl': 'https://evil.example.com/loop.json',
      });
      await RemoteConfig.apply(context, channel);
      expect(lines.some((l) => l.includes('appMap.configurationUrl'))).to.be.false;
    });

    it('logs each applied key', async () => {
      await RemoteConfig.apply(context, channel);
      expect(lines.some((l) => l.includes('appMap.navie.rpcPort'))).to.be.true;
    });

    it('does not log keys whose value is unchanged', async () => {
      vscode.workspace.getConfiguration('appMap').update('navie.rpcPort', 3000);
      nock.cleanAll();
      nock('https://example.com').get('/config.json').reply(200, { 'appMap.navie.rpcPort': 3000 });

      lines.length = 0;
      await RemoteConfig.apply(context, channel);

      expect(lines.filter((l) => l.includes('navie.rpcPort') && l.includes('→'))).to.have.length(0);
    });

    it('stores { url, config } in globalState', async () => {
      await RemoteConfig.apply(context, channel);
      const cached = context.globalState.get<{ url: string; config: Record<string, unknown> }>(
        'remoteConfig'
      );
      expect(cached).to.exist;
      expect(cached?.url).to.equal('https://example.com/config.json');
      expect(cached?.config).to.deep.equal({ 'appMap.navie.rpcPort': 3000 });
    });

    it('logs the active URL and its source', async () => {
      await RemoteConfig.apply(context, channel);
      expect(lines.some((l) => l.includes('https://example.com/config.json'))).to.be.true;
      expect(lines.some((l) => l.includes('setting'))).to.be.true;
    });
  });

  describe('apply() — fetch failure with cached config', () => {
    beforeEach(async () => {
      const url = 'https://example.com/config.json';
      vscode.workspace.getConfiguration('appMap').update('configurationUrl', url);
      await context.globalState.update('remoteConfig', {
        url,
        config: { 'appMap.navie.rpcPort': 4000 },
      });
      nock('https://example.com').get('/config.json').reply(500);
    });

    it('logs a fetch error', async () => {
      await RemoteConfig.apply(context, channel);
      expect(lines.some((l) => l.toLowerCase().includes('fail'))).to.be.true;
    });

    it('falls back to the cached config and applies it', async () => {
      await RemoteConfig.apply(context, channel);
      expect(vscode.workspace.getConfiguration('appMap').get('navie.rpcPort')).to.equal(4000);
    });

    it('logs that a cached configuration is being used', async () => {
      await RemoteConfig.apply(context, channel);
      expect(lines.some((l) => l.toLowerCase().includes('cached'))).to.be.true;
    });
  });

  describe('apply() — fetch failure without cache', () => {
    beforeEach(() => {
      vscode.workspace
        .getConfiguration('appMap')
        .update('configurationUrl', 'https://example.com/config.json');
      nock('https://example.com').get('/config.json').reply(500);
    });

    it('logs the error', async () => {
      await RemoteConfig.apply(context, channel);
      expect(lines.some((l) => l.toLowerCase().includes('fail'))).to.be.true;
    });

    it('does not modify VS Code settings', async () => {
      await RemoteConfig.apply(context, channel);
      expect(vscode.workspace.getConfiguration('appMap').get('navie.rpcPort')).to.be.undefined;
    });

    it('does not modify globalState', async () => {
      await RemoteConfig.apply(context, channel);
      expect(context.globalState.get('remoteConfig')).to.be.undefined;
    });
  });

  describe('apply() — key removal (second call with changed config)', () => {
    it('reverts keys present in old cache but absent from new fetch', async () => {
      const url = 'https://example.com/config.json';
      vscode.workspace.getConfiguration('appMap').update('configurationUrl', url);

      nock('https://example.com')
        .get('/config.json')
        .reply(200, { 'appMap.navie.rpcPort': 3000, 'appMap.useAnimation': true });
      await RemoteConfig.apply(context, channel);

      expect(vscode.workspace.getConfiguration('appMap').get('navie.rpcPort')).to.equal(3000);
      expect(vscode.workspace.getConfiguration('appMap').get('useAnimation')).to.equal(true);

      nock('https://example.com').get('/config.json').reply(200, { 'appMap.navie.rpcPort': 3000 });
      await RemoteConfig.apply(context, channel);

      expect(vscode.workspace.getConfiguration('appMap').get('navie.rpcPort')).to.equal(3000);
      expect(vscode.workspace.getConfiguration('appMap').get('useAnimation')).to.be.undefined;
    });

    it('logs each reverted key', async () => {
      const url = 'https://example.com/config.json';
      vscode.workspace.getConfiguration('appMap').update('configurationUrl', url);

      nock('https://example.com').get('/config.json').reply(200, { 'appMap.useAnimation': true });
      await RemoteConfig.apply(context, channel);

      lines.length = 0;
      nock('https://example.com').get('/config.json').reply(200, {});
      await RemoteConfig.apply(context, channel);

      expect(lines.some((l) => l.includes('useAnimation') && l.includes('Reverting'))).to.be.true;
    });

    it('updates globalState to reflect the new state', async () => {
      const url = 'https://example.com/config.json';
      vscode.workspace.getConfiguration('appMap').update('configurationUrl', url);

      nock('https://example.com')
        .get('/config.json')
        .reply(200, { 'appMap.navie.rpcPort': 3000, 'appMap.useAnimation': true });
      await RemoteConfig.apply(context, channel);

      nock('https://example.com').get('/config.json').reply(200, { 'appMap.navie.rpcPort': 3000 });
      await RemoteConfig.apply(context, channel);

      const cached = context.globalState.get<{ url: string; config: Record<string, unknown> }>(
        'remoteConfig'
      );
      expect(cached?.config).to.deep.equal({ 'appMap.navie.rpcPort': 3000 });
    });
  });

  describe('apply() — URL switch reverts old keys', () => {
    it('reverts keys from the previous URL that are absent from the new URL', async () => {
      const urlA = 'https://a.example.com/config.json';
      const urlB = 'https://b.example.com/config.json';

      vscode.workspace.getConfiguration('appMap').update('configurationUrl', urlA);
      nock('https://a.example.com').get('/config.json').reply(200, { 'appMap.useAnimation': true });
      await RemoteConfig.apply(context, channel);
      expect(vscode.workspace.getConfiguration('appMap').get('useAnimation')).to.equal(true);

      vscode.workspace.getConfiguration('appMap').update('configurationUrl', urlB);
      nock('https://b.example.com')
        .get('/config.json')
        .reply(200, { 'appMap.navie.rpcPort': 3000 });
      await RemoteConfig.apply(context, channel);

      expect(vscode.workspace.getConfiguration('appMap').get('navie.rpcPort')).to.equal(3000);
      expect(vscode.workspace.getConfiguration('appMap').get('useAnimation')).to.be.undefined;
    });
  });

  describe('apply() — URL changed, new URL unreachable', () => {
    it('does not fall back to cache when cached URL differs from current URL', async () => {
      await context.globalState.update('remoteConfig', {
        url: 'https://old.example.com/config.json',
        config: { 'appMap.navie.rpcPort': 9999 },
      });
      vscode.workspace
        .getConfiguration('appMap')
        .update('configurationUrl', 'https://new.example.com/config.json');
      nock('https://new.example.com').get('/config.json').reply(500);

      await RemoteConfig.apply(context, channel);

      expect(vscode.workspace.getConfiguration('appMap').get('navie.rpcPort')).to.be.undefined;
    });

    it('logs an error and leaves settings unchanged', async () => {
      await context.globalState.update('remoteConfig', {
        url: 'https://old.example.com/config.json',
        config: { 'appMap.navie.rpcPort': 9999 },
      });
      vscode.workspace
        .getConfiguration('appMap')
        .update('configurationUrl', 'https://new.example.com/config.json');
      nock('https://new.example.com').get('/config.json').reply(500);

      await RemoteConfig.apply(context, channel);

      expect(lines.some((l) => l.toLowerCase().includes('fail'))).to.be.true;
    });
  });

  describe('setConfigurationUrl command', () => {
    it('shows an empty input box when no setting and no env var are present', async () => {
      const stub = Sinon.stub(vscode.window, 'showInputBox').resolves(undefined);
      await setConfigurationUrl();
      expect(stub.calledOnce).to.be.true;
      expect(stub.firstCall.args[0]?.value).to.equal('');
    });

    it('pre-populates with env var when no explicit setting exists', async () => {
      process.env.APPMAP_CONFIG_URL = 'https://env.example.com/config.json';
      const stub = Sinon.stub(vscode.window, 'showInputBox').resolves(undefined);
      await setConfigurationUrl();
      expect(stub.firstCall.args[0]?.value).to.equal('https://env.example.com/config.json');
    });

    it('pre-populates with the current setting value when one is set', async () => {
      vscode.workspace
        .getConfiguration('appMap')
        .update('configurationUrl', 'https://setting.example.com/config.json');
      const stub = Sinon.stub(vscode.window, 'showInputBox').resolves(undefined);
      await setConfigurationUrl();
      expect(stub.firstCall.args[0]?.value).to.equal('https://setting.example.com/config.json');
    });

    it('writes the entered URL to configurationUrl at Global target on confirm', async () => {
      Sinon.stub(vscode.window, 'showInputBox').resolves('https://new.example.com/config.json');
      await setConfigurationUrl();
      expect(vscode.workspace.getConfiguration('appMap').get('configurationUrl')).to.equal(
        'https://new.example.com/config.json'
      );
    });

    it('removes the setting when an empty string is submitted', async () => {
      vscode.workspace
        .getConfiguration('appMap')
        .update('configurationUrl', 'https://example.com/config.json');
      Sinon.stub(vscode.window, 'showInputBox').resolves('');
      await setConfigurationUrl();
      expect(vscode.workspace.getConfiguration('appMap').get('configurationUrl')).to.be.undefined;
    });

    it('does nothing when the input box is cancelled', async () => {
      vscode.workspace
        .getConfiguration('appMap')
        .update('configurationUrl', 'https://example.com/config.json');
      Sinon.stub(vscode.window, 'showInputBox').resolves(undefined);
      await setConfigurationUrl();
      expect(vscode.workspace.getConfiguration('appMap').get('configurationUrl')).to.equal(
        'https://example.com/config.json'
      );
    });
  });
});
