// @project project-a
import assert, { strictEqual } from 'assert';
import { existsSync, readFileSync, unlinkSync, writeFileSync } from 'fs';
import { resolve } from 'path';
import AppMapService from '../../../src/appMapService';
import {
  AppMapRecommenderService,
  AppMapRecommenderServiceInstance,
} from '../../../src/services/appmapRecommenderService';
import { WorkspaceServiceInstance } from '../../../src/services/workspaceService';
import { retry } from '../../../src/util';
import { waitForExtension } from '../util';

describe('AppMap recommender', async () => {
  let extension: AppMapService;
  let recommender: AppMapRecommenderService;
  let recommenderInstance: AppMapRecommenderServiceInstance;
  let projectDirectory: string;

  beforeEach(async () => {
    extension = await waitForExtension();
    recommender = extension.recommender;
    assert.ok(recommender, 'the service exists');

    let serviceInstances: WorkspaceServiceInstance[] = [];

    await retry(
      () => {
        serviceInstances = extension.workspaceServices.getServiceInstances(recommender);
        if (serviceInstances.length === 0) {
          throw new Error(`Waiting for service instance creation`);
        }
      },
      5,
      1000
    );

    assert.strictEqual(serviceInstances.length, 1, 'a single service instance exists');

    recommenderInstance = serviceInstances[0] as AppMapRecommenderServiceInstance;
    projectDirectory = recommenderInstance.folder.uri.fsPath;
  });

  afterEach(() => {
    unlinkSync(resolve(projectDirectory, '.vscode', 'extensions.json'));
  });

  it('creates extensions.json and adds appmap to recommended extensions', async () => {
    assert(existsSync(projectDirectory));
    assert(existsSync(resolve(projectDirectory, '.vscode')));
    assert(!existsSync(resolve(projectDirectory, '.vscode', 'extensions.json')));

    await recommenderInstance.recommendAppMap();

    assert(existsSync(resolve(projectDirectory, '.vscode', 'extensions.json')));
    const content = readFileSync(resolve(projectDirectory, '.vscode', 'extensions.json'), 'utf-8');
    const expected = '{\n  "recommendations": [\n    "appland.appmap"\n  ]\n}';
    strictEqual(content, expected);
  });

  it('adds appmap to recommended extensions if extensions.json already exists without recommendations', async () => {
    assert(existsSync(projectDirectory));
    assert(existsSync(resolve(projectDirectory, '.vscode')));
    assert(!existsSync(resolve(projectDirectory, '.vscode', 'extensions.json')));

    const initialContent = '{}';
    writeFileSync(resolve(projectDirectory, '.vscode', 'extensions.json'), initialContent);

    assert(existsSync(resolve(projectDirectory, '.vscode', 'extensions.json')));

    await recommenderInstance.recommendAppMap();

    const content = readFileSync(resolve(projectDirectory, '.vscode', 'extensions.json'), 'utf-8');
    const expected = '{\n  "recommendations": [\n    "appland.appmap"\n  ]\n}';
    strictEqual(content, expected);
  });

  it('adds appmap to recommended extensions if extensions.json already exists with recommendations', async () => {
    assert(existsSync(projectDirectory));
    assert(existsSync(resolve(projectDirectory, '.vscode')));
    assert(!existsSync(resolve(projectDirectory, '.vscode', 'extensions.json')));

    const initialContent = '{\n  "recommendations": [\n    "fake.recommendation"\n  ]\n}';
    writeFileSync(resolve(projectDirectory, '.vscode', 'extensions.json'), initialContent);

    assert(existsSync(resolve(projectDirectory, '.vscode', 'extensions.json')));

    await recommenderInstance.recommendAppMap();

    const content = readFileSync(resolve(projectDirectory, '.vscode', 'extensions.json'), 'utf-8');
    const expected =
      '{\n  "recommendations": [\n    "fake.recommendation",\n    "appland.appmap"\n  ]\n}';
    strictEqual(content, expected);
  });
});
