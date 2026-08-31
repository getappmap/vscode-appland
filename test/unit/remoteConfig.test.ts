import './mock/vscode';

import { expect } from 'chai';
import Sinon from 'sinon';
import * as vscode from 'vscode';
import nock from 'nock';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';

import RemoteConfig, { getConfigUrl } from '../../src/configuration/remoteConfig';
import setConfigurationUrl from '../../src/commands/setConfigurationUrl';
import {
  getCustomerId,
  getCustomerIdState,
  seedCustomerId,
  setCustomerId,
} from '../../src/configuration/customerId';
import MockExtensionContext from '../mocks/mockExtensionContext';
import { getOutputChannelLines } from './mock/vscode/window';
import { Configuration, resetConfigurations } from './mock/vscode/workspace';

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

    it('handles malformed JSON gracefully', async () => {
      nock.cleanAll();
      nock('https://example.com').get('/config.json').reply(200, 'not a { json');

      // This should not throw or reject the activation promise
      await RemoteConfig.apply(context, channel);

      expect(lines.some((l) => l.includes('Failed to fetch'))).to.be.true;
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

  // appMap.customerId arrives through the ordinary Config channel, but must not be written
  // through getConfiguration().update() — the key is unregistered in public builds.
  describe('apply() — customer ID', () => {
    const url = 'https://example.com/config.json';

    function bundleDefault(value: string | undefined) {
      (vscode.workspace.getConfiguration('appMap') as Configuration).setDefault(
        'customerId',
        value
      );
    }

    beforeEach(() => {
      vscode.workspace.getConfiguration('appMap').update('configurationUrl', url);
    });

    it('diverts the key to globalState rather than to settings', async () => {
      nock('https://example.com').get('/config.json').reply(200, {
        'appMap.customerId': 'acme-corp',
      });

      await RemoteConfig.apply(context, channel);

      expect(getCustomerIdState(context)).to.deep.equal({
        value: 'acme-corp',
        source: 'orgConfig',
      });
      expect(vscode.workspace.getConfiguration('appMap').get('customerId')).to.be.undefined;
    });

    it('logs the change', async () => {
      nock('https://example.com')
        .get('/config.json')
        .reply(200, { 'appMap.customerId': 'acme-corp' });

      await RemoteConfig.apply(context, channel);

      expect(lines.some((l) => l.includes('appMap.customerId') && l.includes('acme-corp'))).to.be
        .true;
    });

    it('does not log a change when the value is unchanged', async () => {
      nock('https://example.com')
        .get('/config.json')
        .reply(200, { 'appMap.customerId': 'acme-corp' });
      await RemoteConfig.apply(context, channel);

      lines.length = 0;
      nock('https://example.com')
        .get('/config.json')
        .reply(200, { 'appMap.customerId': 'acme-corp' });
      await RemoteConfig.apply(context, channel);

      expect(lines.some((l) => l.includes('appMap.customerId'))).to.be.false;
    });

    it('treats a blank value as no entitlement', async () => {
      nock('https://example.com').get('/config.json').reply(200, { 'appMap.customerId': '   ' });

      await RemoteConfig.apply(context, channel);

      expect(getCustomerId(context)).to.be.undefined;
    });

    // Otherwise removing the key from the remote JSON silently leaves the org entitled.
    it('clears the customer ID when the key disappears from the fetched config', async () => {
      nock('https://example.com')
        .get('/config.json')
        .reply(200, { 'appMap.customerId': 'acme-corp' });
      await RemoteConfig.apply(context, channel);

      nock('https://example.com').get('/config.json').reply(200, {});
      await RemoteConfig.apply(context, channel);

      expect(getCustomerId(context)).to.be.undefined;
    });

    it('reseeds to the bundled default when the key disappears on a bundled build', async () => {
      bundleDefault('bundled-corp');
      nock('https://example.com')
        .get('/config.json')
        .reply(200, { 'appMap.customerId': 'acme-corp' });
      await RemoteConfig.apply(context, channel);

      nock('https://example.com').get('/config.json').reply(200, {});
      await RemoteConfig.apply(context, channel);

      expect(getCustomerIdState(context)).to.deep.equal({
        value: 'bundled-corp',
        source: 'bundled',
      });
    });

    // Deliberate: matches the existing fallback behavior and the offline-resilience goal.
    it('re-establishes entitlement from the cached config when the URL is unreachable', async () => {
      await context.globalState.update('remoteConfig', {
        url,
        config: { 'appMap.customerId': 'acme-corp' },
      });
      nock('https://example.com').get('/config.json').reply(500);

      await RemoteConfig.apply(context, channel);

      expect(getCustomerId(context)).to.equal('acme-corp');
    });

    it('is cleared by rollbackRemoteConfig', async () => {
      nock('https://example.com')
        .get('/config.json')
        .reply(200, { 'appMap.customerId': 'acme-corp' });
      await RemoteConfig.apply(context, channel);

      await RemoteConfig.rollbackRemoteConfig(context, channel);

      expect(getCustomerId(context)).to.be.undefined;
    });
  });

  describe('readAndParseLocalConfig()', () => {
    it('returns a sanitized Config when the file is valid JSON and a valid object', async () => {
      const tempFile = path.join(os.tmpdir(), 'valid-config.json');
      await fs.writeFile(tempFile, '{"appMap.navie.rpcPort": 3000, "other.key": "ignored"}');
      try {
        const config = await RemoteConfig.readAndParseLocalConfig(tempFile);
        expect(config).to.deep.equal({ 'appMap.navie.rpcPort': 3000 });
      } finally {
        await fs.unlink(tempFile).catch(() => undefined);
      }
    });

    it('throws an error when the file contains invalid JSON', async () => {
      const tempFile = path.join(os.tmpdir(), 'invalid-config.json');
      await fs.writeFile(tempFile, 'invalid json');
      try {
        await RemoteConfig.readAndParseLocalConfig(tempFile);
        expect.fail('should have thrown');
      } catch (e: unknown) {
        const message = e instanceof Error ? e.message : String(e);
        expect(message).to.include('Unexpected token');
      } finally {
        await fs.unlink(tempFile).catch(() => undefined);
      }
    });

    it('throws an error when the file is valid JSON but not an object', async () => {
      const tempFile = path.join(os.tmpdir(), 'array-config.json');
      await fs.writeFile(tempFile, '[1, 2, 3]');
      try {
        await RemoteConfig.readAndParseLocalConfig(tempFile);
        expect.fail('should have thrown');
      } catch (e: unknown) {
        const message = e instanceof Error ? e.message : String(e);
        expect(message).to.equal('Configuration is not a valid JSON object');
      } finally {
        await fs.unlink(tempFile).catch(() => undefined);
      }
    });
  });

  describe('setConfigurationUrl command', () => {
    describe('Set URL option', () => {
      beforeEach(() => {
        Sinon.stub(vscode.window, 'showQuickPick').resolves({
          label: 'Set URL',
          key: 'url',
        } as unknown as vscode.QuickPickItem);
      });

      it('shows an empty input box when no setting and no env var are present', async () => {
        const stub = Sinon.stub(vscode.window, 'showInputBox').resolves(undefined);
        await setConfigurationUrl(context, channel);
        expect(stub.calledOnce).to.be.true;
        expect(stub.firstCall.args[0]?.value).to.equal('');
      });

      it('pre-populates with env var when no explicit setting exists', async () => {
        process.env.APPMAP_CONFIG_URL = 'https://env.example.com/config.json';
        const stub = Sinon.stub(vscode.window, 'showInputBox').resolves(undefined);
        await setConfigurationUrl(context, channel);
        expect(stub.firstCall.args[0]?.value).to.equal('https://env.example.com/config.json');
      });

      it('pre-populates with the current setting value when one is set', async () => {
        vscode.workspace
          .getConfiguration('appMap')
          .update('configurationUrl', 'https://setting.example.com/config.json');
        const stub = Sinon.stub(vscode.window, 'showInputBox').resolves(undefined);
        await setConfigurationUrl(context, channel);
        expect(stub.firstCall.args[0]?.value).to.equal('https://setting.example.com/config.json');
      });

      it('writes the entered URL to configurationUrl at Global target on confirm', async () => {
        Sinon.stub(vscode.window, 'showInputBox').resolves('https://new.example.com/config.json');
        await setConfigurationUrl(context, channel);
        expect(vscode.workspace.getConfiguration('appMap').get('configurationUrl')).to.equal(
          'https://new.example.com/config.json'
        );
      });

      it('removes the setting when an empty string is submitted', async () => {
        vscode.workspace
          .getConfiguration('appMap')
          .update('configurationUrl', 'https://example.com/config.json');
        Sinon.stub(vscode.window, 'showInputBox').resolves('');
        await setConfigurationUrl(context, channel);
        expect(vscode.workspace.getConfiguration('appMap').get('configurationUrl')).to.be.undefined;
      });

      it('does nothing when the input box is cancelled', async () => {
        vscode.workspace
          .getConfiguration('appMap')
          .update('configurationUrl', 'https://example.com/config.json');
        Sinon.stub(vscode.window, 'showInputBox').resolves(undefined);
        await setConfigurationUrl(context, channel);
        expect(vscode.workspace.getConfiguration('appMap').get('configurationUrl')).to.equal(
          'https://example.com/config.json'
        );
      });
    });

    describe('Local File option', () => {
      let showQuickPickStub: Sinon.SinonStub;
      let showOpenDialogStub: Sinon.SinonStub;
      let showErrorMessageStub: Sinon.SinonStub;
      let showInformationMessageStub: Sinon.SinonStub;
      let readConfigStub: Sinon.SinonStub;

      beforeEach(() => {
        showQuickPickStub = Sinon.stub(vscode.window, 'showQuickPick').resolves({
          label: 'Local File',
          key: 'file',
        } as unknown as vscode.QuickPickItem);
        showOpenDialogStub = Sinon.stub(vscode.window, 'showOpenDialog');
        showErrorMessageStub = Sinon.stub(vscode.window, 'showErrorMessage');
        showInformationMessageStub = Sinon.stub(vscode.window, 'showInformationMessage');
        readConfigStub = Sinon.stub(RemoteConfig, 'readAndParseLocalConfig');
      });

      it('does nothing when quick pick is cancelled', async () => {
        showQuickPickStub.resolves(undefined);
        await setConfigurationUrl(context, channel);
        expect(showOpenDialogStub.called).to.be.false;
      });

      it('does nothing when open dialog is cancelled', async () => {
        showOpenDialogStub.resolves(undefined);
        await setConfigurationUrl(context, channel);
        expect(readConfigStub.called).to.be.false;
      });

      it('shows error when file is invalid JSON', async () => {
        showOpenDialogStub.resolves([
          { fsPath: '/path/to/invalid.json' },
        ] as unknown as vscode.Uri[]);
        readConfigStub.rejects(new Error('SyntaxError: Unexpected token o in JSON at position 1'));
        await setConfigurationUrl(context, channel);
        expect(showErrorMessageStub.calledOnce).to.be.true;
        expect(showErrorMessageStub.firstCall.args[0]).to.include(
          'Failed to parse configuration file'
        );
      });

      it('shows error when file is valid JSON but not an object', async () => {
        showOpenDialogStub.resolves([{ fsPath: '/path/to/array.json' }] as unknown as vscode.Uri[]);
        readConfigStub.rejects(new Error('Configuration is not a valid JSON object'));
        await setConfigurationUrl(context, channel);
        expect(
          showErrorMessageStub.calledWith(
            'Failed to parse configuration file: Configuration is not a valid JSON object'
          )
        ).to.be.true;
      });

      it('applies configuration when valid, and no active URL exists', async () => {
        showOpenDialogStub.resolves([
          { fsPath: '/path/to/config.json' },
        ] as unknown as vscode.Uri[]);
        readConfigStub.resolves({
          'appMap.navie.rpcPort': 3000,
          'appMap.useAnimation': true,
          'other.key': 'ignored',
        });

        await setConfigurationUrl(context, channel);

        expect(vscode.workspace.getConfiguration('appMap').get('navie.rpcPort')).to.equal(3000);
        expect(vscode.workspace.getConfiguration('appMap').get('useAnimation')).to.equal(true);
        expect(
          showInformationMessageStub.calledWith(
            'Successfully applied local organization configuration. These settings will persist until changed manually.'
          )
        ).to.be.true;
        expect(lines.some((l) => l.includes('Successfully applied configuration from local file')))
          .to.be.true;
      });

      it('diverts a customer ID in the file to globalState', async () => {
        showOpenDialogStub.resolves([
          { fsPath: '/path/to/config.json' },
        ] as unknown as vscode.Uri[]);
        readConfigStub.resolves({ 'appMap.customerId': 'acme-corp' });

        await setConfigurationUrl(context, channel);

        expect(getCustomerIdState(context)).to.deep.equal({
          value: 'acme-corp',
          source: 'orgConfig',
        });
        expect(vscode.workspace.getConfiguration('appMap').get('customerId')).to.be.undefined;
      });

      it('rolls back active configuration URL and cached keys before applying', async () => {
        // First set up an active configuration URL and cache
        vscode.workspace
          .getConfiguration('appMap')
          .update('configurationUrl', 'https://example.com/config.json');
        await context.globalState.update('remoteConfig', {
          url: 'https://example.com/config.json',
          config: { 'appMap.navie.rpcPort': 4000, 'appMap.useAnimation': true },
        });

        // Set the active settings
        vscode.workspace.getConfiguration('appMap').update('navie.rpcPort', 4000);
        vscode.workspace.getConfiguration('appMap').update('useAnimation', true);

        showOpenDialogStub.resolves([
          { fsPath: '/path/to/config.json' },
        ] as unknown as vscode.Uri[]);
        readConfigStub.resolves({ 'appMap.useAnimation': false });

        await setConfigurationUrl(context, channel);

        // Check active URL was removed and cache cleared
        expect(vscode.workspace.getConfiguration('appMap').get('configurationUrl')).to.be.undefined;
        expect(context.globalState.get('remoteConfig')).to.be.undefined;

        // Check previous cache keys not in new file are reverted/reset
        expect(vscode.workspace.getConfiguration('appMap').get('navie.rpcPort')).to.be.undefined;

        // Check new keys are applied correctly
        expect(vscode.workspace.getConfiguration('appMap').get('useAnimation')).to.equal(false);

        // Check rollback and success notifications
        expect(
          showInformationMessageStub.calledWith(
            'An organization configuration URL was active. It has been removed and its settings have been reset before applying the new configuration.'
          )
        ).to.be.true;
        expect(
          showInformationMessageStub.calledWith(
            'Successfully applied local organization configuration. These settings will persist until changed manually.'
          )
        ).to.be.true;
      });
    });

    describe('Clear option', () => {
      let showInformationMessageStub: Sinon.SinonStub;
      let showWarningMessageStub: Sinon.SinonStub;

      beforeEach(() => {
        Sinon.stub(vscode.window, 'showQuickPick').resolves({
          label: 'Clear',
          key: 'clear',
        } as unknown as vscode.QuickPickItem);
        showInformationMessageStub = Sinon.stub(vscode.window, 'showInformationMessage');
        showWarningMessageStub = Sinon.stub(vscode.window, 'showWarningMessage');
      });

      async function applyConfig(config: Record<string, unknown>) {
        const url = 'https://example.com/config.json';
        vscode.workspace.getConfiguration('appMap').update('configurationUrl', url);
        nock('https://example.com').get('/config.json').reply(200, config);
        await RemoteConfig.apply(context, channel);
      }

      it('reverts applied keys, drops the cache and clears the URL', async () => {
        await applyConfig({ 'appMap.navie.rpcPort': 3000 });

        await setConfigurationUrl(context, channel);

        expect(vscode.workspace.getConfiguration('appMap').get('navie.rpcPort')).to.be.undefined;
        expect(context.globalState.get('remoteConfig')).to.be.undefined;
        expect(vscode.workspace.getConfiguration('appMap').get('configurationUrl')).to.be.undefined;
      });

      it('clears the customer ID', async () => {
        await applyConfig({ 'appMap.customerId': 'acme-corp' });

        await setConfigurationUrl(context, channel);

        expect(getCustomerId(context)).to.be.undefined;
      });

      it('reports the reseeded customer ID on a bundled build', async () => {
        (vscode.workspace.getConfiguration('appMap') as Configuration).setDefault(
          'customerId',
          'bundled-corp'
        );
        await applyConfig({ 'appMap.customerId': 'acme-corp' });

        await setConfigurationUrl(context, channel);

        expect(getCustomerIdState(context)).to.deep.equal({
          value: 'bundled-corp',
          source: 'bundled',
        });
        expect(
          showInformationMessageStub
            .getCalls()
            .some((c) => String(c.args[0]).includes('bundled-corp'))
        ).to.be.true;
      });

      // The extension cannot unset an environment variable for the next session.
      it('warns when the URL comes from APPMAP_CONFIG_URL', async () => {
        process.env.APPMAP_CONFIG_URL = 'https://env.example.com/config.json';
        nock('https://env.example.com').get('/config.json').reply(200, {});
        await RemoteConfig.apply(context, channel);

        await setConfigurationUrl(context, channel);

        expect(
          showWarningMessageStub
            .getCalls()
            .some((c) => String(c.args[0]).includes('APPMAP_CONFIG_URL'))
        ).to.be.true;
      });

      // Two toasts at once for one action reads as a malfunction.
      it('reports the outcome in a single notification', async () => {
        process.env.APPMAP_CONFIG_URL = 'https://env.example.com/config.json';
        nock('https://env.example.com')
          .get('/config.json')
          .reply(200, { 'appMap.customerId': 'acme-corp' });
        await RemoteConfig.apply(context, channel);

        await setConfigurationUrl(context, channel);

        expect(showWarningMessageStub.callCount).to.equal(1);
        expect(showInformationMessageStub.called).to.be.false;
        expect(String(showWarningMessageStub.firstCall.args[0])).to.include('cleared');
      });

      it('does not warn when the URL comes from the setting', async () => {
        await applyConfig({});

        await setConfigurationUrl(context, channel);

        expect(showWarningMessageStub.called).to.be.false;
      });
    });

    describe('Status option', () => {
      beforeEach(() => {
        Sinon.stub(vscode.window, 'showQuickPick').resolves({
          label: 'Status',
          key: 'status',
        } as unknown as vscode.QuickPickItem);
      });

      function reportedStatus(): string {
        return lines.join('\n');
      }

      it('reports that the installation is not entitled', async () => {
        await setConfigurationUrl(context, channel);
        expect(reportedStatus()).to.include('not entitled');
      });

      it('reports entitlement via organization config, with the ID', async () => {
        await setCustomerId(context, 'acme-corp', 'orgConfig');

        await setConfigurationUrl(context, channel);

        expect(reportedStatus()).to.include('organization config');
        expect(reportedStatus()).to.include('acme-corp');
      });

      it('reports entitlement via the bundled installation', async () => {
        (vscode.workspace.getConfiguration('appMap') as Configuration).setDefault(
          'customerId',
          'bundled-corp'
        );
        await seedCustomerId(context);

        await setConfigurationUrl(context, channel);

        expect(reportedStatus()).to.include('bundled installation');
        expect(reportedStatus()).to.include('bundled-corp');
      });

      it('reports the configuration URL and its source', async () => {
        vscode.workspace
          .getConfiguration('appMap')
          .update('configurationUrl', 'https://example.com/config.json');

        await setConfigurationUrl(context, channel);

        expect(reportedStatus()).to.include('https://example.com/config.json');
        expect(reportedStatus()).to.include('setting');
      });

      it('reports when no configuration URL is set', async () => {
        await setConfigurationUrl(context, channel);
        expect(reportedStatus()).to.match(/no organization configuration url/i);
      });
    });
  });
});
