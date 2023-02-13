import { default as chai, expect } from 'chai';
import { default as chai_fs } from 'chai-fs';
chai.use(chai_fs);
chai.config.truncateThreshold = 0;

import { join } from 'path';

import ProjectDirectory from '../system/tests/support/project';

describe('ProjectDirectory', () => {
  describe('with default options', () => {
    beforeEach(async function () {
      const projectPath = 'test/fixtures/workspaces/project-system';
      const appmapPath = join('minitest', 'Microposts_interface_micropost_interface.appmap.json');
      this.projectDirectory = new ProjectDirectory(projectPath);
      this.jsonPath = join(this.projectDirectory.appMapDirectoryPath, appmapPath);
    });

    it('will be empty when created', function () {
      const dir = this.projectDirectory;
      expect(dir.workspacePath).to.be.a.directory().and.empty;
    });

    describe('when reset', () => {
      it('contains files from the projet', async function () {
        await this.projectDirectory.reset();
        expect(this.jsonPath).to.be.a.path();
      });

      it('uses the same workspace path', async function () {
        const dir = this.projectDirectory;
        const origAppMapDir = dir.appMapDirectoryPath;
        await dir.reset();
        expect(origAppMapDir).to.equal(dir.appMapDirectoryPath);
      });

      it('can filter out AppMaps', async function () {
        await this.projectDirectory.reset('**/*.appmap.json');
        expect(this.jsonPath).not.to.be.a.path();
      });

      it('can filter out the config file', async function () {
        const dir = await this.projectDirectory.reset('appmap.yml');
        expect(join(dir.workspacePath, 'appmap.yml')).not.to.be.a.path();
      });

      it('can filter with multiple patterns', async function () {
        const dir = await this.projectDirectory.reset('**/*.appmap.json', 'appmap.yml');
        expect(this.jsonPath).not.to.be.a.path();
        expect(join(dir.workspacePath, 'appmap.yml')).not.to.be.a.path();
      });

      it("doesn't exclude a non-matching pattern", async function () {
        await this.projectDirectory.reset('**/*.AppMap.json');
        expect(this.jsonPath).to.be.a.path();
      });
    });

    it('can restore files', async function () {
      const dir = await this.projectDirectory.reset('**/*.appmap.json');
      expect(this.jsonPath).not.to.be.a.path(); // sanity check
      await dir.restoreFiles('**/*.appmap.json');
      expect(this.jsonPath).to.be.a.path();
    });
  });
});
