// @project project-ruby
import assert from 'assert';
import MockExtensionContext from '../mocks/mockExtensionContext';
import { initializeWorkspace, ProjectRuby } from './util';
import LanguageResolver from '../../src/services/languageResolver';
import { promises as fs } from 'fs';
import { join } from 'path';

interface LanguageResolverPrivateAccess {
  LANGUAGE_DISTRIBUTION_CACHE: { [key: string]: Record<string, number> };
  LANGUAGE_CACHE: { [key: string]: string };
}

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

      // Clear the language cache.
      const languageResolver = (LanguageResolver as unknown) as LanguageResolverPrivateAccess;
      languageResolver.LANGUAGE_CACHE = {};
      languageResolver.LANGUAGE_DISTRIBUTION_CACHE = {};
    });

    afterEach(() => {
      context.dispose();
      initializeWorkspace();
    });

    it('correctly identifies the project language', async () => {
      const language = await LanguageResolver.getLanguage(ProjectRuby);
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

      const language = await LanguageResolver.getLanguage(ProjectRuby);
      assert.strictEqual(language, 'ruby');
    });
  });
});
