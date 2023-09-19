import assert from 'assert';
import * as vscode from 'vscode';
import { SinonSandbox, createSandbox } from 'sinon';
import ExtensionState from '../../../src/configuration/extensionState';
import MockExtensionContext from '../../mocks/mockExtensionContext';
import checkAndTriggerFirstAppMapNotification from '../../../src/lib/firstAppMapNotification';

describe('First AppMap notification', () => {
  let sinon: SinonSandbox;
  let context: MockExtensionContext;
  let extensionState: ExtensionState;

  beforeEach(() => {
    sinon = createSandbox();
    context = new MockExtensionContext();
  });

  afterEach(() => {
    context.dispose();
    sinon.restore();
  });

  it('shown just once', async () => {
    const showMessageStub = sinon.stub(vscode.window, 'showInformationMessage');
    extensionState = new ExtensionState(context);
    extensionState.firstAppMapNotificationShown = false;
    await checkAndTriggerFirstAppMapNotification(extensionState);
    assert(showMessageStub.calledWith("You've created your first AppMap! Congratulations."));
    assert.equal(extensionState.firstAppMapNotificationShown, true);
    assert.equal(showMessageStub.callCount, 1);

    await checkAndTriggerFirstAppMapNotification(extensionState);
    // No new show message calls this time, still needs to be 1
    assert.equal(showMessageStub.callCount, 1);
  });
});
