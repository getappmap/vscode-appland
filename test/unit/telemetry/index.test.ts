import '../mock/vscode';

import { expect } from 'chai';
import Sinon from 'sinon';
import * as vscode from 'vscode';
import TelemetryReporter from 'vscode-extension-telemetry';

import ExtensionSettings from '../../../src/configuration/extensionSettings';
import { Telemetry } from '../../../src/telemetry';
import SplunkTelemetryReporter from '../../../src/telemetry/splunkTelemetryReporter';
import { clearCustomerId, setCustomerId } from '../../../src/configuration/customerId';

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

  // Every entry point funnels through Telemetry.send, so the common-property stamp cannot be
  // omitted by accident. The shared cases drive all four.
  describe('common properties', () => {
    let sendEvent: Sinon.SinonStub;
    let sendErrorEvent: Sinon.SinonStub;

    function registerWith(telemetryConfig: Record<string, unknown>) {
      Sinon.stub(ExtensionSettings, 'telemetryConfiguration').get(() => telemetryConfig);
      Telemetry.register(context);
      sendEvent = Sinon.stub(Telemetry.getReporter(), 'sendTelemetryEvent');
      sendErrorEvent = Sinon.stub(Telemetry.getReporter(), 'sendTelemetryErrorEvent');
    }

    // Sends one event through each of the four entry points and returns the properties each
    // one actually handed to the reporter.
    async function propertiesFromEveryEntryPoint(): Promise<Record<string, string>[]> {
      await Telemetry.sendEvent({ name: 'test_event' });
      Telemetry.reportAction('test_action', { 'appmap.some.property': 'value' });
      Telemetry.reportWebviewError({ message: 'boom', stack: 'stack' });
      Telemetry.reportOpenUri(vscode.Uri.parse('file:///tmp/x.appmap.json'));

      expect(sendEvent.callCount).to.equal(3);
      expect(sendErrorEvent.callCount).to.equal(1);

      return [...sendEvent.getCalls(), ...sendErrorEvent.getCalls()].map(
        (call) => call.args[1] as Record<string, string>
      );
    }

    afterEach(() => clearCustomerId(context));

    // Behavior that must hold whichever backend is configured.
    function itStampsTheCustomerId() {
      it('omits common.customerid when no customer ID is set', async () => {
        for (const properties of await propertiesFromEveryEntryPoint()) {
          expect(properties).to.not.have.property('common.customerid');
        }
      });

      it('stamps common.customerid on every entry point', async () => {
        await setCustomerId(context, 'acme-corp', 'orgConfig');

        for (const properties of await propertiesFromEveryEntryPoint()) {
          expect(properties).to.have.property('common.customerid', 'acme-corp');
        }
      });

      it('reads the customer ID per event rather than at registration', async () => {
        Telemetry.reportAction('before');
        await setCustomerId(context, 'acme-corp', 'orgConfig');
        Telemetry.reportAction('after');

        expect(sendEvent.firstCall.args[1]).to.not.have.property('common.customerid');
        expect(sendEvent.secondCall.args[1]).to.have.property('common.customerid', 'acme-corp');
      });

      it('preserves the properties of the event itself', async () => {
        Telemetry.reportAction('test_action', { 'appmap.some.property': 'value' });

        expect(sendEvent.firstCall.args[1]).to.have.property('appmap.some.property', 'value');
      });

      it('lets an event property override a common one', async () => {
        await setCustomerId(context, 'acme-corp', 'orgConfig');

        Telemetry.reportAction('test_action', { 'common.customerid': 'overridden' });

        expect(sendEvent.firstCall.args[1]).to.have.property('common.customerid', 'overridden');
      });
    }

    describe('on the Application Insights backend', () => {
      beforeEach(() => registerWith({}));

      itStampsTheCustomerId();

      // The SDK supplies the rest of the common.* set, but not these two.
      it('adds common.ide and common.ideversion', async () => {
        for (const properties of await propertiesFromEveryEntryPoint()) {
          expect(properties).to.have.property('common.ide', vscode.env.appName);
          expect(properties).to.have.property('common.ideversion', vscode.version);
        }
      });
    });

    describe('on the Splunk backend', () => {
      beforeEach(() => registerWith(SPLUNK_CONFIG));

      itStampsTheCustomerId();

      it('leaves common.ide and common.ideversion to the reporter', async () => {
        for (const properties of await propertiesFromEveryEntryPoint()) {
          expect(properties).to.not.have.property('common.ide');
          expect(properties).to.not.have.property('common.ideversion');
        }
      });
    });

    describe('with APPMAP_TELEMETRY_DEBUG set', () => {
      let channel: { lines: string[]; clear(): void };

      beforeEach(() => {
        process.env.APPMAP_TELEMETRY_DEBUG = 'true';
        const createOutputChannel = Sinon.spy(vscode.window, 'createOutputChannel');

        registerWith({});

        channel = createOutputChannel.returnValues[0] as unknown as typeof channel;
        channel.clear(); // drop the reporter-selection line register() writes
      });

      afterEach(() => {
        delete process.env.APPMAP_TELEMETRY_DEBUG;
        // The debug channel is static and register() never clears it.
        (Telemetry as unknown as { debugChannel?: vscode.OutputChannel }).debugChannel = undefined;
      });

      it('logs exactly what it hands to the reporter', async () => {
        await setCustomerId(context, 'acme-corp', 'orgConfig');

        Telemetry.reportOpenUri(vscode.Uri.parse('file:///tmp/x.appmap.json'));

        const logged = JSON.parse(channel.lines.join('\n'));
        expect(logged.event).to.match(/\/open_uri$/);
        expect(logged.properties).to.deep.equal(sendEvent.firstCall.args[1]);
      });
    });
  });
});
