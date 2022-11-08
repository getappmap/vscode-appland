import { deepStrictEqual } from 'assert';
import { withTmpDir } from '../util';
import { promises as fs } from 'fs';
import * as path from 'path';
import { DEPENDENCIES, HAS_DEVCONTAINER } from '../../../src/telemetry/definitions/properties';

describe('JavaScript project analyzer', () => {
  describe('appmap.project.has_devcontainer', () => {
    it('identifies the presence of a devcontainer.json or .devcontainer.json', async () => {
      await withTmpDir(async (tmpDir) => {
        for (const fileName of ['devcontainer.json', '.devcontainer.json']) {
          const fullPath = path.join(tmpDir, fileName);
          await fs.writeFile(fullPath, '{}', 'utf-8');
          deepStrictEqual(
            await HAS_DEVCONTAINER.getValue({ rootDirectory: tmpDir }),
            'true',
            `Expected to find ${fileName}`
          );
          await fs.rm(fullPath);
        }
      });
    });

    it('identifies the non-presence of a devcontainer configuration', async () => {
      await withTmpDir(async (tmpDir) => {
        deepStrictEqual(await HAS_DEVCONTAINER.getValue({ rootDirectory: tmpDir }), 'false');
      });
    });
  });

  describe('appmap.project.{dependencies,dev_dependencies}', () => {
    it('identifies JavaScript dependencies', async () => {
      const testData = [
        {
          fileContents: {
            dependencies: { react: 'latest', 'react-router': 'latest' },
            devDependencies: {},
          },
          expected: {
            dependencies: 'react,react-router',
          },
        },
        {
          fileContents: {
            dependencies: { react: 'latest', 'react-router': 'latest' },
            devDependencies: { typescript: 'latest', jest: 'latest' },
          },
          expected: {
            dependencies: 'react,react-router',
            dev_dependencies: 'jest,typescript',
          },
        },
        {
          fileContents: {
            devDependencies: { typescript: 'latest', jest: 'latest', aaaa: 'latest' },
          },
          expected: {
            dev_dependencies: 'aaaa,jest,typescript',
          },
        },
        {
          fileContents: {
            dependencies: {},
            devDependencies: {},
          },
          expected: {},
        },
        {
          fileContents: {},
          expected: {},
        },
      ];

      for (const { fileContents, expected } of testData) {
        await withTmpDir(async (tmpDir) => {
          await fs.writeFile(
            path.join(tmpDir, 'package.json'),
            JSON.stringify(fileContents),
            'utf-8'
          );

          const result = await DEPENDENCIES.getValue({ project: { name: 'test', path: tmpDir } });
          deepStrictEqual(result, expected);
        });
      }
    });

    it('resolves nothing without JavaScript dependencies', async () => {
      await withTmpDir(async (tmpDir) => {
        const result = await DEPENDENCIES.getValue({ project: { name: 'test', path: tmpDir } });
        deepStrictEqual(result, undefined);
      });
    });
  });
});
