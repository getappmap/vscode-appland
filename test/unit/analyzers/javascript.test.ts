import '../mock/vscode';
import { Uri, workspace, WorkspaceFolder } from 'vscode';

import { expect } from 'chai';
import sinon from 'sinon';

import analyze from '../../../src/analyzers/javascript';
import assert from 'assert';
import { Features } from '../../../src/analyzers';

describe('JavaScript analyzer', () => {
  test('notes the lack of package.json', null, (f) =>
    expect(f.lang.text).to.include(
      'You can add AppMap to this project by creating a package.json file'
    )
  );

  test('detects express.js', { dependencies: { express: 'latest' } }, (f) =>
    expect(f.web?.score).to.equal('early-access')
  );

  test('detects mocha', { devDependencies: { mocha: 'latest' } }, (f) =>
    expect(f.test).to.include({ title: 'mocha', score: 'early-access' })
  );

  test('rejects old mocha', { devDependencies: { mocha: '^7' } }, (f) =>
    expect(f.test).to.include({ title: 'mocha', score: 'unsupported' })
  );

  test('detects jest', { devDependencies: { jest: 'latest' } }, (f) =>
    expect(f.test).to.include({ title: 'jest', score: 'early-access' })
  );

  test('rejects old jest', { devDependencies: { jest: '^24' } }, (f) =>
    expect(f.test).to.include({ title: 'jest', score: 'unsupported' })
  );
});

function test(title: string, json: unknown, verifier: (f: Features) => void) {
  it(title, async () => {
    const fs = usePackageJson(json);
    const features = (await analyze(testFolder))?.features;
    expect(features).to.exist;
    assert(features);
    verifier(features);
    fs.verify();
  });
}

const testFolder: WorkspaceFolder = {
  uri: Uri.parse('test:///project'),
  name: 'test-project',
  index: 0,
};

function usePackageJson(json: unknown) {
  const fs = sinon.mock(workspace.fs);
  const expectation = fs
    .expects('readFile')
    .withExactArgs(sinon.match((uri: Uri) => uri.toString() === 'test:/project/package.json'));
  if (json) {
    const bin = new TextEncoder().encode(JSON.stringify(json));
    expectation.resolves(bin);
  } else expectation.rejects();

  return fs;
}

afterEach(sinon.restore);
