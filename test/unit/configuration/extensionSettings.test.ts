import '../mock/vscode';

import { expect } from 'chai';
import Sinon from 'sinon';
import * as vscode from 'vscode';

import ExtensionSettings from '../../../src/configuration/extensionSettings';

const SPLUNK_CONFIG = {
  backend: 'splunk' as const,
  url: 'https://splunk.example.com',
  token: 'some-token',
};

describe('ExtensionSettings.appMapCommandLineEnvironment', () => {
  const originalTelemetryEnabled = vscode.env.isTelemetryEnabled;
  let commandLineEnvironment: Record<string, string>;

  beforeEach(() => {
    commandLineEnvironment = {};
    Sinon.stub(vscode.workspace, 'getConfiguration').returns({
      get: (key: string) => (key === 'commandLineEnvironment' ? commandLineEnvironment : undefined),
    } as unknown as vscode.WorkspaceConfiguration);
  });

  afterEach(() => {
    Sinon.restore();
    setTelemetryEnabled(originalTelemetryEnabled);
  });

  function setTelemetryEnabled(value: boolean): void {
    // vscode.env.isTelemetryEnabled is a readonly property at runtime; the mock
    // exposes it as a writable data property so tests can vary it.
    (vscode.env as { isTelemetryEnabled: boolean }).isTelemetryEnabled = value;
  }

  function stubTelemetryConfig(config: Record<string, unknown>): void {
    Sinon.stub(ExtensionSettings, 'telemetryConfiguration').get(() => config);
  }

  describe('with the default (Application Insights) backend', () => {
    beforeEach(() => stubTelemetryConfig({}));

    it('does not disable child-process telemetry when the IDE has telemetry enabled', () => {
      setTelemetryEnabled(true);
      expect(ExtensionSettings.appMapCommandLineEnvironment).to.not.have.property(
        'APPMAP_TELEMETRY_DISABLED'
      );
    });

    it('propagates the IDE telemetry opt-out to child processes', () => {
      setTelemetryEnabled(false);
      expect(ExtensionSettings.appMapCommandLineEnvironment).to.have.property(
        'APPMAP_TELEMETRY_DISABLED',
        'true'
      );
    });

    it('does not override an explicit APPMAP_TELEMETRY_DISABLED from the user environment', () => {
      setTelemetryEnabled(false);
      commandLineEnvironment = { APPMAP_TELEMETRY_DISABLED: 'false' };
      expect(ExtensionSettings.appMapCommandLineEnvironment).to.have.property(
        'APPMAP_TELEMETRY_DISABLED',
        'false'
      );
    });
  });

  describe('with the Splunk backend', () => {
    beforeEach(() => stubTelemetryConfig(SPLUNK_CONFIG));

    it('forces telemetry on regardless of the IDE opt-out (enterprise enforcement)', () => {
      setTelemetryEnabled(false);
      const env = ExtensionSettings.appMapCommandLineEnvironment;
      // 'false' is parsed by the CLI as "not disabled", i.e. telemetry stays on.
      expect(env).to.have.property('APPMAP_TELEMETRY_DISABLED', 'false');
      expect(env).to.have.property('APPMAP_TELEMETRY_BACKEND', 'splunk');
      expect(env).to.have.property('SPLUNK_URL', SPLUNK_CONFIG.url);
      expect(env).to.have.property('SPLUNK_TOKEN', SPLUNK_CONFIG.token);
    });

    it('never disables telemetry even when the IDE has telemetry enabled', () => {
      setTelemetryEnabled(true);
      expect(ExtensionSettings.appMapCommandLineEnvironment).to.have.property(
        'APPMAP_TELEMETRY_DISABLED',
        'false'
      );
    });
  });
});
