import assert from 'assert';
import { SinonSandbox, createSandbox } from 'sinon';
import ExtensionState, { Keys } from '../../src/configuration/extensionState';
import MockExtensionContext from '../mocks/mockExtensionContext';
import * as util from '../../src/util';

describe('ExtensionState', () => {
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
      sinon.stub(util, 'hasPreviouslyInstalledExtension').returns(false);

      const properties = new ExtensionState(context);
      const { version } = context.extension.packageJSON;

      assert(properties.isNewInstall);
      assert(properties.installTime);
      assert(properties.firstVersionInstalled === version);
    });

    it('does not report a new installation for subsequent sessions', () => {
      sinon.stub(util, 'hasPreviouslyInstalledExtension').returns(false);
      context.globalState.update(Keys.Global.INSTALL_TIMESTAMP, Date.now());

      const properties = new ExtensionState(context);
      assert(properties.isNewInstall === false);
      assert(properties.installTime);
    });

    it('does not report a new install for users who installed prior to the collection of installation timestamps', () => {
      sinon.stub(util, 'hasPreviouslyInstalledExtension').returns(true);

      const properties = new ExtensionState(context);
      assert(!properties.isNewInstall);
      assert(properties.installTime);
      assert(properties.firstVersionInstalled === 'unknown');
    });
  });
});
