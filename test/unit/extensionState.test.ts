import './mock/vscode';

import assert from 'assert';

import { expect } from 'chai';
import { SinonSandbox, createSandbox } from 'sinon';
import ExtensionState, { Keys } from '../../src/configuration/extensionState';
import MockExtensionContext from '../mocks/mockExtensionContext';
import * as util from '../../src/util';

describe('ExtensionState', () => {
  describe('isNewAppInstall', () => {
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

  describe('installedPriorTo', () => {
    it('should handle invalid version strings gracefully', () => {
      const result = properties.installedPriorTo('invalid-version');
      expect(result).to.be.false;
    });

    it('should handle unknown version strings', () => {
      const result = properties.installedPriorTo('unknown');
      expect(result).to.be.false;
    });

    it('should return true if the installed version is prior to the given version', () => {
      context.globalState.update(Keys.Global.INSTALL_VERSION, '0.9.0');
      const result = properties.installedPriorTo('1.0.0');
      expect(result).to.be.true;
    });

    it('should return false for older valid version strings', () => {
      context.globalState.update(Keys.Global.INSTALL_VERSION, '1.1.0');
      const result = properties.installedPriorTo('1.0.0');
      expect(result).to.be.false;
    });

    it('should return true if the installed version is unknown', () => {
      context.globalState.update(Keys.Global.INSTALL_VERSION, undefined);
      const result = properties.installedPriorTo('1.0.0');
      expect(result).to.be.true;
    });

    let properties: ExtensionState;
    beforeEach(() => (properties = new ExtensionState(context)));
  });

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
});
