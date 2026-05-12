import '../mock/vscode';

import { expect } from 'chai';
import Sinon from 'sinon';
import { Manifest } from '../../../src/assets';

describe('Manifest.parse', () => {
  beforeEach(() => {
    Sinon.stub(process, 'platform').value('linux');
    Sinon.stub(process, 'arch').value('x64');
  });

  afterEach(() => {
    Sinon.restore();
  });

  it('parses a well-formed manifest', () => {
    const manifest = Manifest.parse({
      tag_name: '@appland/appmap-v1.2.3',
      assets: [
        {
          name: 'appmap-linux-x64',
          url: 'https://example.com/appmap-linux-x64',
          digest: 'sha256:abc',
        },
      ],
    });

    expect(manifest).to.exist;
    expect(manifest?.version).to.equal('1.2.3');
    expect(manifest?.getAsset()).to.deep.equal({
      url: 'https://example.com/appmap-linux-x64',
      digest: 'sha256:abc',
    });
  });

  it('ignores assets whose name has an unrelated suffix after the platform', () => {
    const manifest = Manifest.parse({
      tag_name: 'v1.2.3',
      assets: [
        {
          name: 'appmap-linux-x64-debug',
          url: 'https://example.com/debug',
          digest: 'sha256:debug',
        },
        {
          name: 'appmap-linux-x64',
          url: 'https://example.com/release',
          digest: 'sha256:release',
        },
      ],
    });

    expect(manifest?.getAsset('linux-x64')).to.deep.equal({
      url: 'https://example.com/release',
      digest: 'sha256:release',
    });
  });

  it('keys windows assets by platform, stripping the .exe suffix', () => {
    const manifest = Manifest.parse({
      tag_name: '@appland/scanner-v1.89.1',
      assets: [
        {
          name: 'scanner-win-x64.exe',
          url: 'https://example.com/scanner-win-x64.exe',
          digest: 'sha256:win',
        },
      ],
    });

    expect(manifest?.getAsset('win-x64')).to.deep.equal({
      url: 'https://example.com/scanner-win-x64.exe',
      digest: 'sha256:win',
    });
  });

  it('accepts prerelease and build metadata in tag_name', () => {
    const manifest = Manifest.parse({
      tag_name: '@appland/appmap-v0.0.0-TEST',
      assets: [],
    });

    expect(manifest?.version).to.equal('0.0.0-TEST');
  });

  it('returns undefined when raw is not a manifest-shaped object', () => {
    expect(Manifest.parse(null)).to.be.undefined;
    expect(Manifest.parse('not an object')).to.be.undefined;
    expect(Manifest.parse(42)).to.be.undefined;
    expect(Manifest.parse(true)).to.be.undefined;
    // arrays satisfy typeof === 'object' but lack tag_name, so they fail validation too
    expect(Manifest.parse([])).to.be.undefined;
  });

  it('returns undefined when tag_name is missing or invalid', () => {
    expect(Manifest.parse({ assets: [] })).to.be.undefined;
    expect(Manifest.parse({ tag_name: 'no-version-here', assets: [] })).to.be.undefined;
    expect(Manifest.parse({ tag_name: 123, assets: [] })).to.be.undefined;
  });

  it('returns undefined when assets is not an array', () => {
    expect(Manifest.parse({ tag_name: 'v1.2.3' })).to.be.undefined;
    expect(Manifest.parse({ tag_name: 'v1.2.3', assets: 'oops' })).to.be.undefined;
  });

  it('skips malformed asset entries but keeps valid ones', () => {
    const manifest = Manifest.parse({
      tag_name: 'v1.2.3',
      assets: [
        null,
        'string entry',
        { name: 'no-url' },
        { url: 'no-name' },
        { name: 42, url: 'https://example.com/whatever' },
        { name: 'unknown-platform-foo', url: 'https://example.com/foo' },
        {
          name: 'appmap-linux-x64',
          url: 'https://example.com/appmap-linux-x64',
        },
      ],
    });

    expect(manifest?.getAsset()).to.deep.equal({
      url: 'https://example.com/appmap-linux-x64',
      digest: undefined,
    });
  });

  it('returns undefined for a platform that has no matching asset', () => {
    const manifest = Manifest.parse({
      tag_name: 'v1.2.3',
      assets: [
        {
          name: 'appmap-macos-arm64',
          url: 'https://example.com/appmap-macos-arm64',
          digest: 'sha256:xyz',
        },
      ],
    });

    expect(manifest?.getAsset()).to.be.undefined;
    expect(manifest?.getAsset('macos-arm64')).to.deep.equal({
      url: 'https://example.com/appmap-macos-arm64',
      digest: 'sha256:xyz',
    });
  });
});
