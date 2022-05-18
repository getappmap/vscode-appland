import * as cp from 'child_process';
import * as path from 'path';
import {
  downloadAndUnzipVSCode,
  resolveCliArgsFromVSCodeExecutablePath,
  runTests,
} from '@vscode/test-electron';

async function main() {
  try {
    const extensionDevelopmentPath = path.resolve(__dirname, '..');
    const userDataDir = path.resolve(__dirname, '../.vscode-test/user-data');
    const extensionTestsPath = path.resolve(__dirname, '../out/test/integration/index.js');
    const vscodeExecutablePath = await downloadAndUnzipVSCode('stable');
    const [cliPath] = resolveCliArgsFromVSCodeExecutablePath(vscodeExecutablePath);

    const testWorkspaces = [
      'test/fixtures/workspaces/project-a',
      'test/fixtures/workspaces/project-b',
    ];

    await Promise.all(
      testWorkspaces.map(async (testWorkspace) => {
        await new Promise<void>((resolve, reject) => {
          const proc = cp.exec(`yarn install`, { cwd: testWorkspace });
          proc.on('exit', (code) => {
            if (code !== 0) return reject(code);

            resolve();
          });
        });
      })
    );

    cp.spawnSync(
      cliPath,
      [
        '--extensions-dir',
        extensionDevelopmentPath,
        '--user-data-dir',
        userDataDir,
        '--install-extension',
        'appland.appmap',
        '--force',
      ],
      {
        encoding: 'utf-8',
        stdio: 'inherit',
      }
    );

    // Run the extension test
    await runTests({
      // Use the specified `code` executable
      vscodeExecutablePath,
      extensionDevelopmentPath,
      extensionTestsPath,
      launchArgs: [
        '--user-data-dir',
        userDataDir,
        '--disable-extensions',
        '--disable-gpu',
        testWorkspaces[0],
      ],
    });
  } catch (err) {
    console.error(`Failed to run tests: ${err}`);
    process.exit(1);
  }
}

main();
