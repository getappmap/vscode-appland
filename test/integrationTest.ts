import * as cp from 'child_process';
import { downloadAndUnzipVSCode, runTests as runTestsInElectron } from '@vscode/test-electron';
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
  const sourceTestDir = resolve(__dirname, 'integration');

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
    fileArgs = await promisify(glob)('**/*.test.ts', { cwd: sourceTestDir });
  }

  // The extension test host loads .ts test files directly via ts-node (see
  // integration/bootstrap.js), so we resolve to TypeScript sources — no compiled output.
  // Args ending in .js (e.g. copy-pasted from out/) are mapped back to their source.
  const testFiles = fileArgs.map((file) => {
    const asSource = file.replace(/\.test\.js$/, '.test.ts');
    const fullPath = [
      resolve(sourceTestDir, asSource),
      resolve(projectRootDir, asSource),
      resolve(asSource),
    ].find((candidate) => existsSync(candidate));
    if (!fullPath) throw new Error(`Could not find test file ${file}`);
    return fullPath;
  });

  console.log(`Resolved test paths:\n\t${testFiles.join('\n\t')}`);

  const extensionDevelopmentPath = resolve(__dirname, '..');
  const userDataDir = resolve(__dirname, '../.vscode-test/user-data');

  const vscodeExecutablePath = await downloadAndUnzipVSCode(process.env.VSCODE_INSIDERS_VERSION);

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

  const runTests = async (files: string[], workspaceDir: string) => {
    startTime = new Date();
    await runTestsInElectron({
      vscodeExecutablePath,
      extensionDevelopmentPath,
      // bootstrap.js registers ts-node and loads index.ts, which loads Mocha and the
      // .ts test files named by TEST_FILES.
      extensionTestsPath: resolve(sourceTestDir, 'bootstrap.js'),
      extensionTestsEnv: {
        PROJECT_DIR: workspaceDir, // A hint to resolve relative paths in settings
        TEST_FILES: JSON.stringify(files),
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

  // A test file selects its workspace with a `// @project <name>` header comment (default:
  // project-a; `tmpdir` gets a fresh throwaway directory). Files that share a workspace run
  // together in a single Electron instance instead of one boot per file. A file can opt out
  // of that sharing with `// @isolate` when it corrupts state other suites depend on (e.g.
  // the nodeProcesses tests deliberately crash/abort the shared background processes).
  const resolveWorkspace = async (
    testFile: string
  ): Promise<{ workspaceDir: string; isTmpDir: boolean; isolate: boolean }> => {
    const headerLines = (await promisify(readFile)(testFile, 'utf8')).split('\n');
    const isolate = headerLines.some((line) => /@isolate\b/.test(line));
    const projectNameMatch = headerLines
      .map((line) => line.trim().match(/@project (.*)/))
      .find(Boolean);
    // Resolve the default to the same absolute path an explicit `@project project-a` produces,
    // so default files and project-a files land in one group.
    if (!projectNameMatch)
      return {
        workspaceDir: resolve(__dirname, 'fixtures/workspaces/project-a'),
        isTmpDir: false,
        isolate,
      };

    if (projectNameMatch[1] === 'tmpdir') {
      const dir = join(tmpdir(), `appmap-vscode-test-${Math.random().toString(36).slice(2)}`);
      await mkdir(dir, { recursive: true });
      return { workspaceDir: dir, isTmpDir: true, isolate };
    }

    const dir = resolve(__dirname, 'fixtures/workspaces', projectNameMatch[1]);
    assert(await promisify(exists)(dir), `Project ${dir} does not exist`);
    return { workspaceDir: dir, isTmpDir: false, isolate };
  };

  const groups = new Map<string, { workspaceDir: string; isTmpDir: boolean; files: string[] }>();
  for (const testFile of testFiles) {
    const { workspaceDir, isTmpDir, isolate } = await resolveWorkspace(testFile);
    // Isolated files (and tmpdir workspaces, which are unique per file) each get their own
    // group so they run in a dedicated Electron instance.
    const key = isolate ? `isolate:${testFile}` : workspaceDir;
    const group = groups.get(key);
    if (group) group.files.push(testFile);
    else groups.set(key, { workspaceDir, isTmpDir, files: [testFile] });
  }

  let succeeded = true;
  for (const { workspaceDir, isTmpDir, files } of groups.values()) {
    console.log(
      `Running ${files.length} integration test(s) in ${workspaceDir}:\n\t${files.join('\n\t')}`
    );

    try {
      await runTests(files, workspaceDir);
    } catch (e) {
      succeeded = false;
      console.warn(`Tests in ${workspaceDir} failed: ${e}`);
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
      if (isTmpDir) {
        await rm(workspaceDir, { recursive: true });
      }
    }
  }
  process.exitCode = succeeded ? TestStatus.Ok : TestStatus.Failed;
}

integrationTest().catch((e) => {
  console.warn(e);
  process.exitCode = TestStatus.Error;
});
