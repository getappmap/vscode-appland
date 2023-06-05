import assert from 'assert';
import jsAnalyzer from '../../../src/analyzers/javascript';
import { withTmpDir } from '../util';
import { promises as fs } from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';

describe('JavaScript project analyzer', () => {
  describe('dependency identification', () => {
    it('identifies the latest version of mocha', async () => {
      await withTmpDir(async (tmpDir) => {
        const packageJson = {
          devDependencies: {
            mocha: 'latest',
          },
        };

        await fs.writeFile(path.join(tmpDir, 'package.json'), JSON.stringify(packageJson), 'utf-8');

        const workspaceFolder: vscode.WorkspaceFolder = {
          name: path.basename(tmpDir),
          uri: vscode.Uri.parse(tmpDir),
          index: -1,
        };
        const result = await jsAnalyzer(workspaceFolder);

        assert(result);
        assert(result.features.test);
        assert(result.features.test.score == 'early-access');
      });
    });
  });
});
