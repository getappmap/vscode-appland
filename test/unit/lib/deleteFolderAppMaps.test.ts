import MockVSCode from '../mock/vscode';

import { default as chai, expect } from 'chai';
import { default as chaiFs } from 'chai-fs';
import { randomUUID } from 'crypto';
import { promises as fs } from 'fs';
import { tmpdir } from 'os';
import path from 'path';
import Sinon from 'sinon';
import sinonChai from 'sinon-chai';
import { URI } from 'vscode-uri';

import deleteFolderAppMaps from '../../../src/lib/deleteFolderAppMaps';

import MockAppMapCollection from '../../mocks/mockAppMapCollection';
import MockAppMapLoader from '../../mocks/mockAppMapLoader';

chai.use(chaiFs);
chai.use(sinonChai);

describe('deleteFolderAppMaps', () => {
  let projectName: string;
  let projectDir: string;
  let indexDir: string;
  let appMapUri: URI;
  let sandbox: Sinon.SinonSandbox;
  let mockCollection: MockAppMapCollection;

  beforeEach(async () => {
    sandbox = Sinon.createSandbox();
    projectName = randomUUID();
    projectDir = path.join(tmpdir(), projectName);
    indexDir = path.join(projectDir, 'test');
    appMapUri = URI.file(path.join(projectDir, 'test.appmap.json'));
    mockCollection = new MockAppMapCollection();
    sandbox
      .stub(mockCollection, 'appMaps')
      .returns([new MockAppMapLoader({ resourceUri: appMapUri })]);
    sandbox.stub(mockCollection, 'has').returns(true);
    sandbox.stub(mockCollection, 'remove').returns();

    await fs.mkdir(indexDir, { recursive: true });
    await fs.writeFile(appMapUri.fsPath, '{}');
  });

  afterEach(async () => {
    await fs.rm(projectDir, { recursive: true, force: true });
    sandbox.restore();
  });

  it('deletes AppMaps by project', async () => {
    const getWorkspaceFolder = Sinon.stub(MockVSCode.workspace, 'getWorkspaceFolder')
      .withArgs(appMapUri)
      .returns({ uri: URI.file(projectDir), name: projectName, index: 0 });

    expect(appMapUri.fsPath).to.be.a.file();

    await deleteFolderAppMaps(mockCollection, projectName);

    expect(getWorkspaceFolder).to.have.been.calledOnce;
    expect(appMapUri.fsPath).to.not.be.a.path();
  });
});
