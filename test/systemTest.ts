import glob from 'glob';
import Mocha from 'mocha';
import * as path from 'path';
import { downloadCode, launchCode } from './system/src/app';
import Driver from './system/src/driver';
import ProjectDirectory from './system/tests/support/project';
import { TestStatus } from './TestStatus';
import projectRootDirectory from 'project-root-directory';

async function main(): Promise<void> {
  try {
    const extensionDevelopmentPath = projectRootDirectory;
    const userDataDir = path.resolve(projectRootDirectory, '.vscode-test', 'user-data');
    const projectPath = path.join(
      projectRootDirectory,
      'test',
      'fixtures',
      'workspaces',
      'project-system'
    );

    let verbose = false;
    let testPath = path.join(__dirname, 'system', 'tests', '**', '*.test.[jt]s');
    const patterns: string[] = [];
    const cliArgs = process.argv.slice(2);
    while (cliArgs.length > 0) {
      const arg = cliArgs.shift() as string;
      switch (arg) {
        case '--verbose':
          verbose = true;
          break;

        case '--pattern':
        case '-p':
          {
            const pattern = cliArgs.shift();
            if (!pattern) {
              throw new Error('Missing pattern');
            }
            patterns.push(pattern);
          }
          break;

        default:
          testPath = path.isAbsolute(arg) ? arg : path.resolve(arg);
      }
    }

    const TIMEOUT = Number(process.env.TEST_TIMEOUT || 60000);
    const beforeAll: Mocha.Func = async function() {
      this.codePath = await downloadCode();
    };
    const beforeEach: Mocha.Func = async function() {
      const project = new ProjectDirectory(projectPath);

      const { app, context, page } = await launchCode(
        this.codePath,
        extensionDevelopmentPath,
        userDataDir,
        {
          workspacePath: project.workspacePath,
          verbose,
        }
      );
      const driver = new Driver(app, context, page);
      context.setDefaultTimeout(TIMEOUT);

      await driver.waitForReady();
      this.app = app;
      this.driver = driver;
      this.project = project;
    };
    const afterEach: Mocha.Func = async function() {
      await Promise.all([this.app.waitForEvent('close'), this.app.close()]);
    };

    const mocha = new Mocha({
      ui: 'bdd',
      color: true,
      timeout: TIMEOUT,
      reporter: Mocha.reporters.Spec,
      rootHooks: {
        beforeAll,
        beforeEach,
        afterEach,
      },
    });
    patterns.forEach((pattern) => mocha.grep(pattern));

    return new Promise((_, reject) => {
      glob(testPath, { cwd: __dirname }, (err, files) => {
        if (err) {
          return reject(err);
        }

        // Add files to the test suite
        files.forEach((f) => {
          mocha.addFile(f);
        });

        mocha.run((failures) => {
          process.exitCode = failures === 0 ? TestStatus.Ok : TestStatus.Failed;
        });
      });
    });
  } catch (err) {
    console.error(err);
    process.exitCode = TestStatus.Error;
  }
}

main();
