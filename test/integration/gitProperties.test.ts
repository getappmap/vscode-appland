import assert from 'assert';
import GitProperties, { buildIgnore } from '../../src/telemetry/properties/versionControlGit';
import { ProjectA, withTmpDir } from './util';
import { promises as fs } from 'fs';
import * as path from 'path';

describe('GitProperties', () => {
  describe('buildIgnore', () => {
    it('accepts trailing Windows path separators', async () => {
      await withTmpDir(async (tmpDir) => {
        const gitIgnorePath = path.join(tmpDir, '.gitignore');
        const gitIgnoreContents = ['# comment', 'trailing\\', 'node_modules'].join('\n');
        await fs.writeFile(gitIgnorePath, gitIgnoreContents, 'utf-8');

        const ignore = await buildIgnore(gitIgnorePath);
        assert(!ignore.ignores('# comment'));
        assert(ignore.ignores('trailing'));
        assert(ignore.ignores('trailing/file'));
        assert(ignore.ignores('node_modules'));
      });
    });
  });

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
