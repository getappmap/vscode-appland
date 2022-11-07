import { deepStrictEqual } from 'assert';
import { withTmpDir } from '../util';
import { promises as fs } from 'fs';
import * as path from 'path';
import { HAS_DEVCONTAINER } from '../../../src/telemetry/definitions/properties';

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
});
