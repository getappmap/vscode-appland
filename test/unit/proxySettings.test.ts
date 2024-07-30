import './mock/vscode';
import * as vscode from 'vscode';

import sinon from 'sinon';
import { proxySettings, isRunningWithProxy } from '../../src/lib/proxySettings';
import { expect } from 'chai';

describe('proxySettings', () => {
  let getConfigurationMock;
  let originalEnv;

  before(() => {
    // Save the original environment variables
    originalEnv = { ...process.env };
  });

  beforeEach(() => {
    // Mock the getConfiguration method of vscode.workspace
    getConfigurationMock = sinon.stub(vscode.workspace, 'getConfiguration').returns({
      get: sinon.stub().callsFake((key) => {
        if (key === 'http.proxy') return 'http://mock-http-proxy';
        if (key === 'http.noProxy') return ['localhost'];
        return undefined;
      }),
    } as any);

    // Set mock environment variables
    process.env.http_proxy = 'http://env-http-proxy';
    process.env.https_proxy = 'https://env-https-proxy';
    process.env.no_proxy = 'localhost,127.0.0.1';
  });

  afterEach(() => {
    // Restore the original environment variables
    process.env = { ...originalEnv };

    // Restore the original getConfiguration method
    getConfigurationMock.restore();
  });

  it('should return the correct proxy settings', () => {
    const settings = proxySettings();
    expect(settings).to.deep.equal({
      tool: 'vscode',
      http_proxy: 'http://mock-http-proxy',
      https_proxy: 'https://env-https-proxy',
      no_proxy: ['localhost'],
      vscode: {
        'http.proxy': 'http://mock-http-proxy',
        'http.noProxy': ['localhost'],
      },
      env: {
        http_proxy: 'http://env-http-proxy',
        https_proxy: 'https://env-https-proxy',
        no_proxy: 'localhost,127.0.0.1',
      },
    });
  });

  it('should return true if running with proxy', () => {
    expect(isRunningWithProxy()).to.be.true;
  });

  it('should return false if not running with proxy', () => {
    getConfigurationMock.returns({
      get: sinon.stub().returns(undefined),
    });
    process.env.http_proxy = undefined;
    expect(isRunningWithProxy()).to.be.false;
  });
});
