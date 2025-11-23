import nock from 'nock';
import { GithubReleaseCache } from '../../../src/assets';

type AssetVersionMocks = {
  appmap?: string;
  scanner?: string;
  javaAgent?: string;
  denylist?: string[];
};
function mockApi(url: URL | string, response: () => nock.Body, denylist: string[]) {
  const { origin, pathname } = typeof url === 'string' ? new URL(url) : url;
  const isDenylisted = denylist.some((deny) => origin.includes(deny));
  const scope = nock(origin).get(pathname);
  return isDenylisted ? scope.reply(403) : scope.reply(200, response());
}
const defaultVersion = '0.0.0-TEST';

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
    'https://registry.npmjs.org/@appland/appmap/latest',
    () => ({ version: options.appmap }),
    options.denylist
  );
  mockApi(
    'https://registry.npmjs.org/@appland/scanner/latest',
    () => ({ version: options.scanner }),
    options.denylist
  );
  mockApi(
    'https://api.github.com/repos/getappmap/appmap-java/releases/latest',
    () => ({
      tag_name: `v${options.javaAgent}`,
    }),
    options.denylist
  );
  mockApi(
    'https://api.github.com/repos/getappmap/appmap-js/releases',
    () => [
      { tag_name: `@appland/appmap-v${options.appmap}` },
      { tag_name: `@appland/scanner-v${options.scanner}` },
    ],
    options.denylist
  );
  mockApi(
    `https://repo1.maven.org/maven2/com/appland/appmap-agent/${options.javaAgent}/appmap-agent-${options.javaAgent}.jar`,
    () => '<insert jar here>',
    options.denylist
  );
  mockApi(
    `https://github.com/getappmap/appmap-java/releases/download/v${options.javaAgent}/appmap-${options.javaAgent}.jar`,
    () => '<insert jar here>',
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
        () => '<insert scanner here>',
        options.denylist
      );
      mockApi(
        `https://github.com/getappmap/appmap-js/releases/download/%40appland/appmap-v${options.appmap}/appmap-${binarySuffix}`,
        () => '<insert appmap cli here>',
        options.denylist
      );
    }
  }

  return options;
}

mockAssetApis.restore = () => {
  nock.cleanAll();
  GithubReleaseCache.clear();
};
