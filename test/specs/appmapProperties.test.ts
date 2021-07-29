import assert from 'assert';
import * as vscode from 'vscode';
import { SinonSandbox, createSandbox } from 'sinon';
import AppMapProperties, { Keys } from '../../src/appmapProperties';
import MockExtensionContext from '../mocks/mockExtensionContext';

describe('AppMapProperties', () => {
  describe('isNewAppInstall', () => {
    let sinon: SinonSandbox;
    let context: MockExtensionContext;

    beforeEach(() => {
      sinon = createSandbox();
      context = new MockExtensionContext();
    });

    afterEach(() => {
      context.dispose();
      sinon.restore();
    });

    it('correctly reports new installations', () => {
      sinon.stub(vscode.env, 'isNewAppInstall').value(true);

      const properties = new AppMapProperties(context);
      assert(properties.isNewInstall);
      assert(context.globalState.get(Keys.Global.INSTALL_TIMESTAMP));
    });

    it('does not report a new installation for subsequent sessions', () => {
      sinon.stub(vscode.env, 'isNewAppInstall').value(true);
      context.globalState.update(Keys.Global.INSTALL_TIMESTAMP, Date.now());

      const properties = new AppMapProperties(context);
      assert(properties.isNewInstall === false);
      assert(context.globalState.get(Keys.Global.INSTALL_TIMESTAMP));
    });

    it('does not report a new install for users who installed prior to the collection of installation timestamps', () => {
      sinon.stub(vscode.env, 'isNewAppInstall').value(false);

      const properties = new AppMapProperties(context);
      assert(properties.isNewInstall === false);
      assert(context.globalState.get(Keys.Global.INSTALL_TIMESTAMP) === undefined);
    });
  });
});
