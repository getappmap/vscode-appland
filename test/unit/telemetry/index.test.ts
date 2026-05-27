import '../mock/vscode';
import { Telemetry } from '../../../src/telemetry';
import ExtensionSettings from '../../../src/configuration/extensionSettings';
import Sinon from 'sinon';
import * as vscode from 'vscode';

describe('Telemetry', () => {
  let context: vscode.ExtensionContext;

  beforeEach(() => {
    context = {
      subscriptions: [],
      globalState: {
        get: Sinon.stub(),
        update: Sinon.stub(),
      },
    } as unknown as vscode.ExtensionContext;
  });

  afterEach(() => {
    Sinon.restore();
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
});
