import assert from 'assert';
import { exists, writeFileSync } from 'fs';
import { join } from 'path';
import { promisify } from 'util';
import * as vscode from 'vscode';
import AppMapService from '../../src/appMapService';
import { ExampleAppMap, ExampleAppMapIndexDir, initializeWorkspace, touch, waitFor } from './util';

describe('CodeObjects', () => {
  beforeEach(initializeWorkspace);
  afterEach(initializeWorkspace);

  it('should be loaded on startup', async () => {
    let extension: vscode.Extension<AppMapService> | undefined;

    waitFor(`Extension not available`, () => {
      const ext = vscode.extensions.getExtension('appland.appmap');
      if (ext && ext.isActive) {
        extension = ext;
        return true;
      }
      return false;
    });

    if (!extension) throw new Error(`Extension not available`);

    await touch(ExampleAppMap);

    const classMapFile = join(ExampleAppMapIndexDir, 'classMap.json');
    await waitFor(`classMap.json should be generated `, async () =>
      promisify(exists)(classMapFile)
    );

    const appMapService = extension.exports;
    assert.ok(appMapService.classMap);
    await waitFor(`ClassMap not available`, async () => {
      if (!appMapService.classMap) return false;
      return (await appMapService.classMap.classMap()).length > 0;
    });

    const classMap = await appMapService.classMap.classMap();
    writeFileSync('test_classMap.json', JSON.stringify(classMap, null, 2));
  });
});
