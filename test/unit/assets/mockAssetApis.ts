import nock from 'nock';
import * as vscode from 'vscode';
import { GithubReleaseCache, ManifestManager } from '../../../src/assets';

type AssetVersionMocks = {
  appmap?: string;
  scanner?: string;
  javaAgent?: string;
  // Substrings matched against the whole URL; matching endpoints reply 403.
  // Matching on the full URL (not just the origin) lets a test block e.g. only
  // the Maven jar while leaving maven-metadata.xml reachable.
  denylist?: string[];
  // Override the digest advertised by the mock manifests, e.g. to exercise the
  // digest-verification failure path.
  appmapDigest?: string;
  scannerDigest?: string;
};
function mockApi(url: URL | string, response: () => nock.Body, denylist: string[]) {
  const { origin, pathname, href } = typeof url === 'string' ? new URL(url) : url;
  const isDenylisted = denylist.some((deny) => href.includes(deny));
  const scope = nock(origin).get(pathname);
  return isDenylisted ? scope.reply(403) : scope.reply(200, response());
}
const defaultVersion = '0.0.0-TEST';

// SHA-256 digests of the mock binary bodies below. The mock manifests advertise
// these so that digest verification succeeds in the happy path; if you edit
// either side, recompute the other or tests will fail mysteriously.
const APPMAP_BODY = '<insert appmap cli here>';
const APPMAP_DIGEST = 'sha256:83e6257769b2afdd319b1ab87ab962cc25a40190c59f0b3c693758eab12edc13';
const SCANNER_BODY = '<insert scanner here>';
const SCANNER_DIGEST = 'sha256:77618356db5ce696f63b4b64d30da9ec22118628d68d3cad69a2ae70c2217791';

// The two Java agent sources serve distinct bodies so tests can tell which one
// a download actually came from.
export const JAVA_AGENT_MAVEN_BODY = '<insert jar here>';
export const JAVA_AGENT_GITHUB_BODY = '<insert github jar here>';

export default function mockAssetApis(opts: AssetVersionMocks = {}) {
  const options = {
    appmap: defaultVersion,
    scanner: defaultVersion,
    javaAgent: defaultVersion,
    denylist: [],
    ...opts,
  };

  mockApi(
    'https://repo1.maven.org/maven2/com/appland/appmap-agent/maven-metadata.xml',
    () => `<release>${options.javaAgent}</release>`,
    options.denylist
  );
  mockApi(
    `https://repo1.maven.org/maven2/com/appland/appmap-agent/${options.javaAgent}/appmap-agent-${options.javaAgent}.jar`,
    () => JAVA_AGENT_MAVEN_BODY,
    options.denylist
  );
  mockApi(
    'https://api.github.com/repos/getappmap/appmap-java/releases',
    () => [{ tag_name: `v${options.javaAgent}` }],
    options.denylist
  );
  mockApi(
    `https://github.com/getappmap/appmap-java/releases/download/v${options.javaAgent}/appmap-${options.javaAgent}.jar`,
    () => JAVA_AGENT_GITHUB_BODY,
    options.denylist
  );

  // mock all the platform/arch combinations so tests don't have to care about
  // what the current platform/arch is
  const platforms = ['linux', 'macos', 'win'];
  const archs = ['x64', 'arm64'];
  for (const platform of platforms) {
    for (const arch of archs) {
      const binarySuffix = `${platform}-${arch}${platform === 'win' ? '.exe' : ''}`;
      mockApi(
        `https://github.com/getappmap/appmap-js/releases/download/%40appland/scanner-v${options.scanner}/scanner-${binarySuffix}`,
        () => SCANNER_BODY,
        options.denylist
      );
      mockApi(
        `https://github.com/getappmap/appmap-js/releases/download/%40appland/appmap-v${options.appmap}/appmap-${binarySuffix}`,
        () => APPMAP_BODY,
        options.denylist
      );
    }
  }

  mockApi(
    'https://raw.githubusercontent.com/getappmap/appmap-js/release-manifests/appmap-latest.json',
    () => ({
      tag_name: `@appland/appmap-v${options.appmap}`,
      assets: platforms.flatMap((platform) =>
        archs.map((arch) => {
          const binarySuffix = `${platform}-${arch}${platform === 'win' ? '.exe' : ''}`;
          return {
            name: `appmap-${binarySuffix}`,
            url: `https://github.com/getappmap/appmap-js/releases/download/%40appland/appmap-v${options.appmap}/appmap-${binarySuffix}`,
            digest: options.appmapDigest ?? APPMAP_DIGEST,
          };
        })
      ),
    }),
    options.denylist
  );
  mockApi(
    'https://raw.githubusercontent.com/getappmap/appmap-js/release-manifests/scanner-latest.json',
    () => ({
      tag_name: `@appland/scanner-v${options.scanner}`,
      assets: platforms.flatMap((platform) =>
        archs.map((arch) => {
          const binarySuffix = `${platform}-${arch}${platform === 'win' ? '.exe' : ''}`;
          return {
            name: `scanner-${binarySuffix}`,
            url: `https://github.com/getappmap/appmap-js/releases/download/%40appland/scanner-v${options.scanner}/scanner-${binarySuffix}`,
            digest: options.scannerDigest ?? SCANNER_DIGEST,
          };
        })
      ),
    }),
    options.denylist
  );

  // Clear any per-test manifest overrides left in the shared vscode config mock.
  const config = vscode.workspace.getConfiguration('appMap');
  config.update('manifest', undefined);

  return options;
}

mockAssetApis.restore = () => {
  nock.cleanAll();
  GithubReleaseCache.clear();
  ManifestManager.clearCache();
};
