import { deepStrictEqual } from 'assert';
import { unsafeCast, withTmpDir } from '../util';
import { promises as fs } from 'fs';
import * as path from 'path';
import { Finding } from '@appland/scanner';
import {
  DEPENDENCIES,
  FINDINGS_SUMMARY,
  FINDING_SUMMARY,
  HAS_DEVCONTAINER,
} from '../../../src/telemetry/definitions/properties';

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

  describe('appmap.analysis', () => {
    const findings = unsafeCast<ReadonlyArray<Finding>>([
      {
        impactDomain: 'Maintainability',
        hash_v2: '1',
        ruleId: 'rule-id-1',
        hash: '2',
      },
      { impactDomain: 'Maintainability', hash_v2: '1', ruleId: 'rule-id-1' },
      { impactDomain: 'Security', hash_v2: '2', ruleId: 'rule-id-2' },
    ]);

    it('summarizes a finding', async () => {
      const result = await FINDING_SUMMARY.getValue({ finding: findings[0] });
      deepStrictEqual(result, {
        impact_domain: 'maintainability',
        hash_v2: '1',
        rule: 'rule-id-1',
        hash: '2',
      });
    });

    it('summarizes all findings', async () => {
      const result = await FINDINGS_SUMMARY.getValue({ findings });
      deepStrictEqual(result, {
        rules: 'rule-id-1,rule-id-2',
        impact_domains: 'maintainability,security',
      });
    });
  });
});
