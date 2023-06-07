import '../mock/vscode';
import { Uri, workspace, WorkspaceFolder } from 'vscode';

import { expect } from 'chai';
import sinon from 'sinon';

import analyze, { parseYarnPkgSpec } from '../../../src/analyzers/javascript';
import assert from 'assert';
import { Features } from '../../../src/analyzers';

describe('JavaScript analyzer', () => {
  test('notes the lack of package.json', {}, (f) =>
    expect(f.lang.text).to.include(
      'You can add AppMap to this project by creating a package.json file'
    )
  );

  test('detects express.js', { pkg: { dependencies: { express: 'latest' } } }, (f) =>
    expect(f.web?.score).to.equal('early-access')
  );

  test(
    'detects express.js in package-lock.json',
    { pkg: {}, pkgLock: { dependencies: { express: { version: '4.18.1' } } } },
    (f) => expect(f.web?.score).to.equal('early-access')
  );

  test(
    'detects express.js in yarn.lock',
    { pkg: {}, yarnLock: 'express@npm:^4: { version: 4.18.1 }' },
    (f) => expect(f.web?.score).to.equal('early-access')
  );

  test(
    'detects express.js in old-style yarn.lock',
    { pkg: {}, yarnLock: `# yarn lockfile v1\nexpress@^4:\n  version "4.18.1"\n` },
    (f) => expect(f.web?.score).to.equal('early-access')
  );

  test('detects mocha', { pkg: { devDependencies: { mocha: 'latest' } } }, (f) =>
    expect(f.test).to.include({ title: 'mocha', score: 'early-access' })
  );

  test('rejects old mocha', { pkg: { devDependencies: { mocha: '^7' } } }, (f) =>
    expect(f.test).to.include({ title: 'mocha', score: 'unsupported' })
  );

  test('detects jest', { pkg: { devDependencies: { jest: 'latest' } } }, (f) =>
    expect(f.test).to.include({ title: 'jest', score: 'early-access' })
  );

  test('rejects old jest', { pkg: { devDependencies: { jest: '^24' } } }, (f) =>
    expect(f.test).to.include({ title: 'jest', score: 'unsupported' })
  );

  type DepFiles = {
    pkg?: unknown;
    pkgLock?: unknown;
    yarnLock?: string;
  };

  function test(title: string, deps: DepFiles, verifier: (f: Features) => void) {
    it(title, async () => {
      useDepFiles(deps);
      const features = (await analyze(testFolder))?.features;
      expect(features).to.exist;
      assert(features);
      verifier(features);
    });
  }

  const testFolder: WorkspaceFolder = {
    uri: Uri.parse('test:///project'),
    name: 'test-project',
    index: 0,
  };

  function useDepFiles(deps: DepFiles) {
    sinon.stub(workspace.fs, 'readFile').callsFake(async (uri) => {
      let result: string | undefined = undefined;
      switch (uri.toString()) {
        case 'test:/project/package.json':
          result = deps.pkg ? JSON.stringify(deps.pkg) : undefined;
          break;
        case 'test:/project/package-lock.json':
          result = deps.pkgLock ? JSON.stringify(deps.pkgLock) : undefined;
          break;
        case 'test:/project/yarn.lock':
          result = deps.yarnLock ? deps.yarnLock : undefined;
          break;
        default:
          throw new Error(`unexpected read of ${uri.toString()}`);
      }

      if (result) return new TextEncoder().encode(result);
      throw new Error(`mock read error of ${uri.toString()}`);
    });
  }

  afterEach(sinon.restore);
});

describe('parseYarnPkgSpec', () => {
  test('pkg', 'pkg');
  test('pkg@^4.2', 'pkg');
  test('pkg@source:^4.2', 'pkg');
  test('@org/pkg', '@org/pkg');
  test('@org/pkg@^4.2', '@org/pkg');
  test('@org/pkg@source:^4.2', '@org/pkg');

  function test(example: string, name: string) {
    it(`parses ${example} correctly`, () => expect(parseYarnPkgSpec(example).name).to.equal(name));
  }
});
