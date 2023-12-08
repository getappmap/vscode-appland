/* eslint-disable @typescript-eslint/no-explicit-any */
import mockVscode from '../mock/vscode';

import assert from 'assert';
import { SinonSandbox, createSandbox } from 'sinon';

import RemoteRecording from '../../../src/actions/remoteRecording';
import RemoteRecordingClient from '../../../src/actions/remoteRecordingClient';
import { tmpdir } from 'os';
import { randomUUID } from 'crypto';
import path from 'path';
import { existsSync, mkdirSync, rmSync } from 'fs';

describe('remote recording', () => {
  let sinon: SinonSandbox;
  let remoteRecording: RemoteRecording;
  let tmpDir: string;
  let mockWorkspaceServices: any;
  let mockWorkspaceFolder: any;
  let mockedMap: any;

  beforeEach(() => {
    sinon = createSandbox();
    tmpDir = path.join(tmpdir(), randomUUID());

    const mockContext = {
      subscriptions: [],
    } as any;

    mockWorkspaceServices = {
      getServiceInstanceFromClass() {
        return;
      },
    };

    mockWorkspaceFolder = {
      uri: {
        fsPath: tmpDir,
      },
    };

    mockedMap = { metadata: {} };

    remoteRecording = new RemoteRecording(mockContext, mockWorkspaceServices);
  });

  afterEach(() => {
    sinon.restore();
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it('returns false on command stop with a 404 response', async () => {
    sinon.stub(RemoteRecordingClient, 'stop').resolves({ statusCode: 404, body: undefined });
    const response = await remoteRecording.stop('http://localhost:8080/');
    assert(!response);
  });

  it('returns false on command stop with no appmap name', async () => {
    sinon.stub(mockVscode.window, 'showInputBox').resolves('');
    const response = await remoteRecording.stop('http://localhost:8080/');
    assert(!response);
  });

  it('uses appmap_dir as the output folder', async () => {
    const expectedName = 'test_map_name';
    const mockConfigManager = {
      getAppmapConfig() {
        return {
          appmapDir: 'fake/appmap',
        };
      },
    };

    sinon.stub(RemoteRecordingClient, 'stop').resolves({ statusCode: 200, body: mockedMap });
    sinon.stub(mockVscode.workspace, 'workspaceFolders').value([mockWorkspaceFolder]);
    sinon.stub(mockVscode.window, 'showInputBox').returns(expectedName);
    sinon.stub(mockWorkspaceServices, 'getServiceInstanceFromClass').returns(mockConfigManager);

    const response = await remoteRecording.stop('http://localhost:8080/');

    assert(response);
    assert.strictEqual(mockedMap.metadata.name, expectedName);
    assert(
      existsSync(path.join(tmpDir, 'fake', 'appmap', 'recordings', expectedName + '.appmap.json'))
    );
    assert(!existsSync(path.join(tmpDir, 'tmp', 'appmap', 'recordings')));
    assert(!existsSync(path.join(tmpDir, 'build', 'appmap', 'recordings')));
    assert(!existsSync(path.join(tmpDir, 'target', 'appmap', 'recordings')));
  });

  it('uses tmp/appmap as the output folder if there is no appmap_dir', async () => {
    const expectedName = 'test_map_name';

    sinon.stub(RemoteRecordingClient, 'stop').resolves({ statusCode: 200, body: mockedMap });
    sinon.stub(mockVscode.workspace, 'workspaceFolders').value([mockWorkspaceFolder]);
    sinon.stub(mockVscode.window, 'showInputBox').returns(expectedName);

    const response = await remoteRecording.stop('http://localhost:8080/');

    assert(response);
    assert.strictEqual(mockedMap.metadata.name, expectedName);
    assert(
      existsSync(path.join(tmpDir, 'tmp', 'appmap', 'recordings', expectedName + '.appmap.json'))
    );
    assert(!existsSync(path.join(tmpDir, 'build', 'appmap', 'recordings')));
    assert(!existsSync(path.join(tmpDir, 'target', 'appmap', 'recordings')));
  });

  it('uses build/appmap as the output folder if it exists and there is no appmap_dir', async () => {
    mkdirSync(path.join(tmpDir, 'build', 'appmap'), { recursive: true });
    const expectedName = 'test_map_name';

    sinon.stub(RemoteRecordingClient, 'stop').resolves({ statusCode: 200, body: mockedMap });
    sinon.stub(mockVscode.workspace, 'workspaceFolders').value([mockWorkspaceFolder]);
    sinon.stub(mockVscode.window, 'showInputBox').returns(expectedName);

    const response = await remoteRecording.stop('http://localhost:8080/');

    assert(response);
    assert.strictEqual(mockedMap.metadata.name, expectedName);
    assert(
      existsSync(path.join(tmpDir, 'build', 'appmap', 'recordings', expectedName + '.appmap.json'))
    );
    assert(!existsSync(path.join(tmpDir, 'tmp', 'appmap', 'recordings')));
    assert(!existsSync(path.join(tmpDir, 'target', 'appmap', 'recordings')));
  });

  it('uses target/appmap as the output folder if the config does not have an appmap_dir and target/appmap exists', async () => {
    mkdirSync(path.join(tmpDir, 'target', 'appmap'), { recursive: true });
    const expectedName = 'test_map_name';
    const mockConfigManager = {
      getAppmapConfig() {
        return {};
      },
    };

    sinon.stub(RemoteRecordingClient, 'stop').resolves({ statusCode: 200, body: mockedMap });
    sinon.stub(mockVscode.workspace, 'workspaceFolders').value([mockWorkspaceFolder]);
    sinon.stub(mockVscode.window, 'showInputBox').returns(expectedName);
    sinon.stub(mockWorkspaceServices, 'getServiceInstanceFromClass').returns(mockConfigManager);

    const response = await remoteRecording.stop('http://localhost:8080/');

    assert(response);
    assert.strictEqual(mockedMap.metadata.name, expectedName);
    assert(
      existsSync(path.join(tmpDir, 'target', 'appmap', 'recordings', expectedName + '.appmap.json'))
    );
    assert(!existsSync(path.join(tmpDir, 'tmp', 'appmap', 'recordings')));
    assert(!existsSync(path.join(tmpDir, 'build', 'appmap', 'recordings')));
  });
});
