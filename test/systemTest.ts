import * as path from 'path';
import glob from 'glob';
import Mocha from 'mocha';
import { launchCode } from './system/src/app';
import Driver from './system/src/driver';

async function main(): Promise<void> {
  try {
    const extensionDevelopmentPath = path.resolve(__dirname, '..', '..');
    const userDataDir = path.resolve(__dirname, '..', '..', '.vscode-test', 'user-data');
    const workspacePath = path.join(
      __dirname,
      '..',
      '..',
      'test',
      'fixtures',
      'workspaces',
      'project-system'
    );

    let verbose = false;
    let leaveOpen = false;
    let testPath = path.join(__dirname, 'system', 'tests', '**', '*.test.js');
    const patterns: string[] = [];
    const cliArgs = process.argv.slice(2);
    while (cliArgs.length > 0) {
      const arg = cliArgs.shift() as string;
      switch (arg) {
        case '--leave-open':
          leaveOpen = true;
          break;

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

    const { app, context, page } = await launchCode(extensionDevelopmentPath, userDataDir, {
      workspacePath,
      verbose,
    });

    const driver = new Driver(app, context, page);
    const mocha = new Mocha({
      ui: 'bdd',
      color: true,
      timeout: '120s',
      rootHooks: {
        async beforeAll() {
          await driver.waitForReady();
        },
      },
    });

    mocha.suite.ctx.app = app;
    mocha.suite.ctx.context = context;
    mocha.suite.ctx.page = page;
    mocha.suite.ctx.driver = driver;
    mocha.suite.ctx.workspacePath = workspacePath;

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

        mocha.run(async (failures) => {
          if (!leaveOpen) {
            await app.process().kill();
            process.exit(failures === 0 ? 0 : 1);
          }
        });

        try {
          // Run the mocha test
        } catch (exception) {
          console.error(exception);
          reject(exception);
        }
      });
    });
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

main();
