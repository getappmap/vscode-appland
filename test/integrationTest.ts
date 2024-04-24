import * as cp from 'child_process';
import {
  downloadAndUnzipVSCode,
  resolveCliArgsFromVSCodeExecutablePath,
  runTests as runTestsInElectron,
} from '@vscode/test-electron';
import { exists, existsSync, readFile } from 'fs';
import { promisify } from 'util';
import { glob } from 'glob';
import { join, resolve } from 'path';
import assert from 'assert';
import { TestStatus } from './TestStatus';
import { spawnSync } from 'child_process';
import { mkdir, rm, stat } from 'fs/promises';
import { tmpdir } from 'os';

const PROJECT_A = 'test/fixtures/workspaces/project-a';
const PROJECT_UPTODATE = 'test/fixtures/workspaces/project-uptodate';
const testWorkspaces = [PROJECT_A, PROJECT_UPTODATE];
const failFast = process.argv.includes('--fail-fast');

let startTime = new Date();

async function asyncFilter<T>(
  collection: Iterable<T>,
  predicate: (x: T) => Promise<boolean>
): Promise<T[]> {
  const results: T[] = [];
  const checks: Promise<void>[] = [];
  const maybePush = async (x: T) => {
    if (await predicate(x)) results.push(x);
  };

  for (const x of collection) checks.push(maybePush(x));

  await Promise.all(checks);
  return results;
}

async function integrationTest() {
  const projectRootDir = resolve(__dirname, '..');
  const testDir = resolve(__dirname, '../out/test/integration');

  let fileArgs = process.argv.slice(1);
  if (fileArgs.length > 1) {
    const matchedArgs = fileArgs.filter((arg) => arg.match(/\.test\.(?:js|ts)$/));
    if (matchedArgs.length === 0) {
      throw new Error(`No test files matched ${fileArgs}`);
    }
    fileArgs = matchedArgs;
    console.log(
      `Running specific tests provided by command line arguments:\n\t${fileArgs.join('\n\t')}`
    );
  } else {
    fileArgs = [];
  }

  if (fileArgs.length === 0) {
    console.log(`Running all integration tests`);
    fileArgs = (await promisify(glob)('**/*.test.js', { cwd: testDir })).map((file) =>
      resolve(testDir, file)
    );
  }

  const resolvedTestFiles = fileArgs.map((file) => {
    // Accept file paths relative to the project root or to the test dir.
    const fullPath = [resolve(testDir, file), resolve(projectRootDir, file)].find((fullPath) => {
      return existsSync(fullPath);
    });
    if (!fullPath) throw new Error(`Could not find test file ${file}`);

    return fullPath;
  });
  fileArgs.forEach((file, index) => {
    if (!resolvedTestFiles[index]) {
      console.warn(`Could not find test file ${file}`);
    }
  });
  const testFiles = resolvedTestFiles.map((path) => {
    if (!path) throw new Error(`File path must be truthy`);
    if (path.endsWith('.js')) return path;
    const tokens = path.slice(projectRootDir.length).split('/');
    return resolve(
      testDir,
      tokens.slice(3, -1).join('/'),
      tokens[tokens.length - 1].replace('.ts', '.js')
    );
  }) as string[];

  testFiles.forEach((testFile) => assert(existsSync(testFile)));

  console.log(`Resolved test paths:\n\t${testFiles.join('\n\t')}`);

  const extensionDevelopmentPath = resolve(__dirname, '..');
  const userDataDir = resolve(__dirname, '../.vscode-test/user-data');

  const vscodeExecutablePath = await downloadAndUnzipVSCode(process.env.VSCODE_INSIDERS_VERSION);
  const [cliPath] = resolveCliArgsFromVSCodeExecutablePath(vscodeExecutablePath);

  if (process.env.TEST_YARN_INSTALL !== 'false') {
    await Promise.all(
      testWorkspaces.map(async (testWorkspace) => {
        await new Promise<void>((resolve, reject) => {
          const proc = cp.exec(`yarn install`, { cwd: testWorkspace });
          proc.on('message', console.log);
          proc.on('error', console.warn);
          proc.on('exit', (code) => {
            if (code !== 0) return reject(code);

            resolve();
          });
        });
      })
    );
  }

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
      '--password-store=basic',
    ],
    {
      encoding: 'utf-8',
      stdio: 'inherit',
    }
  );

  const runTests = async (testFile: string, workspaceDir: string) => {
    startTime = new Date();
    await runTestsInElectron({
      vscodeExecutablePath,
      extensionDevelopmentPath,
      // TEST_PATH env var sends the actual test names. index.js is a wrapper which loads Mocha, etc.
      extensionTestsPath: resolve(testDir, 'index.js'),
      extensionTestsEnv: {
        PROJECT_DIR: workspaceDir, // A hint to resolve relative paths in settings
        TEST_FILE: testFile,
        APPMAP_WRITE_PIDFILE: 'true',
        APPMAP_INTEGRATION_TEST: 'true',
      },
      launchArgs: [
        '--user-data-dir',
        userDataDir,
        '--disable-gpu',
        '--password-store=basic',
        workspaceDir,
      ],
    });
  };

  let succeeded = true;
  for (const testFile of testFiles) {
    console.log(`Running integration test: ${testFile}`);

    const preconfigureFile = testFile.replace('.test.js', '.preconfigure.js');
    if (await promisify(exists)(preconfigureFile)) {
      console.log(`Running preconfiguration script ${preconfigureFile}`);
      try {
        /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
        const preconfigurationScript = (await import(resolve(preconfigureFile))) as any;
        await preconfigurationScript.default();
      } catch (e) {
        succeeded = false;
        console.warn(`Test preconfiguration script ${preconfigureFile} failed: ${e}`);
        continue;
      }
    }

    // To specify a workspace project, embed a comment in the test case like:
    // // @project project-name
    const headerLines = (await promisify(readFile)(testFile, 'utf8')).split('\n');
    const projectNameMatch = headerLines
      .map((line) => line.trim().match(/@project (.*)/))
      .find(Boolean);

    let projectName: string | undefined;
    let isTmpDir = false;
    if (projectNameMatch) {
      if (projectNameMatch[1] === 'tmpdir') {
        projectName = join(tmpdir(), `appmap-vscode-test-${Math.random().toString(36).slice(2)}`);
        await mkdir(projectName, { recursive: true });
        isTmpDir = true;
      } else {
        projectName = resolve(__dirname, 'fixtures/workspaces', projectNameMatch[1]);
        assert(await promisify(exists)(projectName), `Project ${projectName} does not exist`);
        console.log(`Using workspace ${projectName}`);
      }
    }

    try {
      await runTests(testFile, projectName || PROJECT_A);
    } catch (e) {
      succeeded = false;
      console.warn(`Test ${testFile} failed: ${e}`);
      const logs = await asyncFilter(
        glob.sync('.vscode-test/user-data/logs/**/?-AppMap Services.log'),
        async (path) => (await stat(path)).mtime > startTime
      );

      logs.forEach((f) => {
        console.log(`${f}:`);
        console.log(spawnSync('cat', [f]).stdout.toString());
      });
      if (failFast) break;
    } finally {
      if (isTmpDir && projectName) {
        await rm(projectName, { recursive: true });
      }
    }
  }
  process.exitCode = succeeded ? TestStatus.Ok : TestStatus.Failed;
}

integrationTest().catch((e) => {
  console.warn(e);
  process.exitCode = TestStatus.Error;
});
