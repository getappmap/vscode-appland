import '../mock/vscode';

import { default as chai, expect } from 'chai';
import { default as chaiFs } from 'chai-fs';
import { randomUUID } from 'crypto';
import { promises as fs } from 'fs';
import { tmpdir } from 'os';
import path from 'path';
import sinon from 'sinon';
import { URI } from 'vscode-uri';

import MockAppMapCollection from '../../mocks/mockAppMapCollection';

import deleteAppMap from '../../../src/lib/deleteAppMap';

chai.use(chaiFs);

describe('deleteAppMap', () => {
  let tmpDir: string;
  let indexDir: string;
  let appMapUri: URI;
  let sandbox: sinon.SinonSandbox;

  beforeEach(async () => {
    sandbox = sinon.createSandbox();
    tmpDir = path.join(tmpdir(), randomUUID());
    indexDir = path.join(tmpDir, 'test');
    appMapUri = URI.file(path.join(tmpDir, 'test.appmap.json'));

    await fs.mkdir(indexDir, { recursive: true });
    await fs.writeFile(appMapUri.fsPath, '{}');
  });

  afterEach(async () => {
    sandbox.restore();
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  it('retains the index directory if the AppMap is already known to the collection', async () => {
    const mockCollection = new MockAppMapCollection();
    sandbox.stub(mockCollection, 'has').returns(true);
    sandbox.stub(mockCollection, 'remove').returns();

    await deleteAppMap(appMapUri, mockCollection);

    expect(indexDir).to.be.a.directory();
    expect(appMapUri.fsPath).to.not.be.a.path();
  });

  it('deletes the index directory if the AppMap has not yet been acknowledged by the collection', async () => {
    const mockCollection = new MockAppMapCollection();
    sandbox.stub(mockCollection, 'has').returns(false);
    sandbox.stub(mockCollection, 'remove').returns();

    await deleteAppMap(appMapUri, mockCollection);

    expect(indexDir).to.not.be.a.path();
    expect(appMapUri.fsPath).to.not.be.a.path();
  });
});
