import '../mock/vscode';

import { expect } from 'chai';
import nock from 'nock';
import { GitHubReleaseResolver, GithubReleaseCache } from '../../../src/assets';

describe('GitHubReleaseResolver', () => {
  afterEach(() => {
    nock.cleanAll();
    GithubReleaseCache.clear();
  });

  it('should ignore pre-release versions and return the latest stable version', async () => {
    nock('https://api.github.com')
      .get('/repos/getappmap/appmap-js/releases')
      .reply(200, [
        { tag_name: '@appland/appmap-v1.2.4-beta' },
        { tag_name: '@appland/appmap-v1.2.3' },
        { tag_name: '@appland/appmap-v1.2.2' },
      ]);

    const resolver = new GitHubReleaseResolver('getappmap/appmap-js', '@appland/appmap-v');
    const latestVersion = await resolver.getLatestVersion();
    expect(latestVersion).to.equal('1.2.3');
  });

  it('should handle tags without a prefix', async () => {
    nock('https://api.github.com')
      .get('/repos/getappmap/appmap-java/releases')
      .reply(200, [
        { tag_name: 'v1.5.0-beta' },
        { tag_name: 'v1.4.0' },
        { tag_name: '1.3.0' }, // no 'v' prefix
        { tag_name: 'v1.2.0' },
      ]);

    const resolver = new GitHubReleaseResolver('getappmap/appmap-java');
    const latestVersion = await resolver.getLatestVersion();
    expect(latestVersion).to.equal('1.4.0');
  });

  it('should return undefined if no stable version is found', async () => {
    nock('https://api.github.com')
      .get('/repos/getappmap/appmap-js/releases')
      .reply(200, [
        { tag_name: '@appland/appmap-v1.2.4-beta' },
        { tag_name: '@appland/appmap-v1.2.3-alpha' },
      ]);

    const resolver = new GitHubReleaseResolver('getappmap/appmap-js', '@appland/appmap-v');
    const latestVersion = await resolver.getLatestVersion();
    expect(latestVersion).to.be.undefined;
  });

  describe('live API tests', () => {
    // This test only runs if the environment variable RUN_LIVE_API_TESTS is set to 'true'
    if (process.env.RUN_LIVE_API_TESTS !== 'true') {
      it.skip('Skipping live API tests (set RUN_LIVE_API_TESTS=true to enable)');
      return;
    }

    it('should fetch the latest AppMap CLI version from GitHub', async () => {
      // This test makes a real network request to GitHub API
      const appmapCliResolver = new GitHubReleaseResolver(
        'getappmap/appmap-js',
        '@appland/appmap-v'
      );
      const latestVersion = await appmapCliResolver.getLatestVersion();

      expect(latestVersion).to.not.be.undefined;
      expect(latestVersion).to.match(/^\d+\.\d+\.\d+$/); // e.g., 1.2.3
      console.log(`Latest AppMap CLI version: ${latestVersion}`);
    }).timeout(10000); // Give a longer timeout for live API calls

    it('should fetch the latest AppMap Scanner version from GitHub', async () => {
      // This test makes a real network request to GitHub API
      const scannerResolver = new GitHubReleaseResolver(
        'getappmap/appmap-js',
        '@appland/scanner-v'
      );
      const latestVersion = await scannerResolver.getLatestVersion();

      expect(latestVersion).to.not.be.undefined;
      expect(latestVersion).to.match(/^\d+\.\d+\.\d+$/); // e.g., 1.2.3
      console.log(`Latest AppMap Scanner version: ${latestVersion}`);
    }).timeout(10000); // Give a longer timeout for live API calls
  });
});
