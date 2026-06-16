import '../mock/vscode';

import { expect } from 'chai';
import Sinon from 'sinon';
import * as vscode from 'vscode';
import TelemetryReporter from 'vscode-extension-telemetry';

import ExtensionSettings from '../../../src/configuration/extensionSettings';
import { Telemetry } from '../../../src/telemetry';
import SplunkTelemetryReporter from '../../../src/telemetry/splunkTelemetryReporter';

import MockExtensionContext from '../../mocks/mockExtensionContext';

const SPLUNK_CONFIG = { backend: 'splunk', url: 'https://splunk.example.com', token: 'some-token' };

function stubConfigChange(): (section: string) => void {
  let listener: ((e: vscode.ConfigurationChangeEvent) => void) | undefined;
  Sinon.stub(vscode.workspace, 'onDidChangeConfiguration').callsFake((cb) => {
    listener = cb;
    return {
      dispose: () => {
        /* no-op */
      },
    };
  });
  return (section: string) => {
    expect(listener, 'onDidChangeConfiguration listener').to.not.be.undefined;
    listener?.({ affectsConfiguration: (s: string) => s === section });
  };
}

describe('Telemetry', () => {
  let context: vscode.ExtensionContext;

  beforeEach(() => {
    context = new MockExtensionContext();
  });

  afterEach(() => {
    Sinon.restore();
    void Telemetry.dispose();
  });

  it('does not crash activation if Splunk URL is invalid', () => {
    Sinon.stub(ExtensionSettings, 'telemetryConfiguration').get(() => ({
      backend: 'splunk',
      url: 'invalid-url',
      token: 'some-token',
    }));

    // This would have previously thrown and killed extension activation.
    // Now it should be caught internally in Telemetry.register.
    Telemetry.register(context);
  });

  it('initializes the Splunk reporter if configured', () => {
    Sinon.stub(ExtensionSettings, 'telemetryConfiguration').get(() => SPLUNK_CONFIG);

    Telemetry.register(context);
    expect(Telemetry.getReporter()).to.be.instanceOf(SplunkTelemetryReporter);
  });

  it('initializes the AppInsights reporter by default', () => {
    Sinon.stub(ExtensionSettings, 'telemetryConfiguration').get(() => ({}));

    Telemetry.register(context);
    expect(Telemetry.getReporter()).to.be.instanceOf(TelemetryReporter);
  });

  it('reconfigures dynamically when telemetry settings change', () => {
    const fireConfigChange = stubConfigChange();
    const configStub = Sinon.stub(ExtensionSettings, 'telemetryConfiguration').get(() => ({}));

    Telemetry.register(context);
    const initialReporter = Telemetry.getReporter();
    expect(initialReporter).to.be.instanceOf(TelemetryReporter);
    const disposeSpy = Sinon.spy(initialReporter, 'dispose');

    configStub.get(() => SPLUNK_CONFIG);
    fireConfigChange('appMap.telemetry');

    expect(disposeSpy.calledOnce).to.be.true;
    expect(Telemetry.getReporter()).to.be.instanceOf(SplunkTelemetryReporter);
  });

  it('does not reconfigure if other configuration settings change', () => {
    const fireConfigChange = stubConfigChange();
    Sinon.stub(ExtensionSettings, 'telemetryConfiguration').get(() => ({}));

    Telemetry.register(context);
    const initialReporter = Telemetry.getReporter();
    expect(initialReporter).to.be.instanceOf(TelemetryReporter);
    const disposeSpy = Sinon.spy(initialReporter, 'dispose');

    fireConfigChange('appMap.someOtherSetting');

    expect(disposeSpy.called).to.be.false;
    expect(Telemetry.getReporter()).to.equal(initialReporter);
  });
});
