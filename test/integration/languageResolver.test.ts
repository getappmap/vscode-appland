// @project project-ruby
import assert from 'assert';
import MockExtensionContext from '../mocks/mockExtensionContext';
import { initializeWorkspace, ProjectRuby } from './util';
import LanguageResolver from '../../src/services/languageResolver';
import { promises as fs } from 'fs';
import { join } from 'path';

const createOrReplace = async (f: () => Promise<void>): Promise<void> => {
  try {
    await f();
  } catch (e) {
    const err = e as { code: string };
    if (err.code !== 'EEXIST') {
      throw e;
    }
  }
};

describe('LanguageResolver', () => {
  describe('getLanguage', () => {
    let context: MockExtensionContext;

    beforeEach(() => {
      context = new MockExtensionContext();
      initializeWorkspace();
      LanguageResolver.clearCache();
    });

    afterEach(() => {
      context.dispose();
      initializeWorkspace();
      LanguageResolver.clearCache();
    });

    it('correctly identifies the project language', async () => {
      const languages = await LanguageResolver.getLanguages(ProjectRuby);
      const language = languages[0];
      assert.strictEqual(language, 'ruby');
    });

    it('correctly identifies the project language with nested * gitignore filter', async () => {
      // Add a child directory with a .gitignore file ignoring all files.
      createOrReplace(async () => {
        await fs.mkdir(join(ProjectRuby, 'ignored_dir'));
      });

      createOrReplace(async () => {
        await fs.writeFile(join(ProjectRuby, 'ignored_dir', '.gitignore'), '*');
      });

      const languages = await LanguageResolver.getLanguages(ProjectRuby);
      const language = languages[0];
      assert.strictEqual(language, 'ruby');
    });
  });
});
