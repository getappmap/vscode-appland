import { exec } from 'child_process';
import * as path from 'path';
import { runTests } from 'vscode-test';

async function main(): Promise<void> {
  try {
    // The folder containing the Extension Manifest package.json
    // Passed to `--extensionDevelopmentPath`
    const extensionDevelopmentPath = path.resolve(__dirname, '..');

    // The path to the extension test script
    // Passed to --extensionTestsPath
    const extensionTestsPath = path.resolve(__dirname, '../out/test/integration/index.js');

    const testWorkspace = 'test/fixtures/workspaces/project-with-findings';

    await new Promise<void>((resolve, reject) => {
      const proc = exec(`yarn install`, { cwd: testWorkspace });
      proc.on('exit', (code) => {
        if (code !== 0) return reject(code);

        resolve();
      });
    });

    // Download VS Code, unzip it and run the integration test
    await runTests({
      extensionDevelopmentPath,
      extensionTestsPath,
      launchArgs: ['--disable-extensions', '--disable-gpu', testWorkspace],
      version: 'insiders',
    });
  } catch (err) {
    console.error('Failed to run tests');
    process.exit(1);
  }

  // HACK.
  // I'm not sure why this is necessary, but this prevents the process from hanging after the tests have been run.
  process.exit(0);
}

main();
