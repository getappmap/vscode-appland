import assert from 'assert';
import GitProperties from '../../src/telemetry/properties/versionControlGit';
import { ProjectA } from './util';
import * as path from 'path';
import * as vscode from 'vscode';

describe('GitProperties', () => {
  describe('isIgnored', () => {
    let gitProperties: GitProperties;
    const absoluteProjectPath = path.resolve(ProjectA);

    beforeEach(async () => {
      gitProperties = new GitProperties();
      await gitProperties.initialize(absoluteProjectPath);
    });

    it('accepts various paths', () => {
      assert(!gitProperties.isIgnored(`file://${absoluteProjectPath}/filename`));
      assert(!gitProperties.isIgnored(`${absoluteProjectPath}/filename`));
      assert(!gitProperties.isIgnored(`${absoluteProjectPath}//filename`));
      assert(!gitProperties.isIgnored(`/filename`));
    });

    it('returns ignored paths', () => {
      assert(gitProperties.isIgnored(`${absoluteProjectPath}/node_modules`));
      assert(gitProperties.isIgnored(`${absoluteProjectPath}/node_modules/@appland`));
      assert(!gitProperties.isIgnored(`${absoluteProjectPath}/package.json`));
    });
  });
});
