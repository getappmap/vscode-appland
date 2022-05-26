import * as path from 'path';
import glob from 'glob';
import Mocha from 'mocha';
import { launchCode } from './smoke/src/app';
import Driver from './smoke/src/driver';

async function main(): Promise<void> {
  try {
    const extensionDevelopmentPath = path.resolve(__dirname, '..', '..');
    const userDataDir = path.resolve(__dirname, '../.vscode-test/user-data');
    const workspacePath = path.join(
      __dirname,
      '..',
      '..',
      'test',
      'fixtures',
      'workspaces',
      'project-base'
    );

    let verbose = false;
    let leaveOpen = false;
    let testPath = path.join(__dirname, 'smoke', 'tests', '**', '*.test.js');
    const cliArgs = process.argv.slice(2);
    while (cliArgs.length > 0) {
      const arg = cliArgs.shift() as string;
      if (arg === '--leave-open') {
        leaveOpen = true;
      } else if (arg === '--verbose') {
        verbose = true;
      } else {
        testPath = path.isAbsolute(arg) ? arg : path.resolve(arg);
      }
    }

    const { app, context, page } = await launchCode(extensionDevelopmentPath, userDataDir, {
      workspacePath,
      verbose,
    });

    const driver = new Driver(app, context, page);

    // await new Promise<void>((resolve, reject) => {
    //   console.info(`Setting up workspace at ${testWorkspace} ...`);
    //   const proc = exec(`yarn install`, { cwd: testWorkspace });
    //   proc.stdout?.on('data', console.log);
    //   proc.stderr?.on('data', console.log);
    //   proc.on('exit', (code) => {
    //     if (code !== 0) return reject(new Error(`process exited with code ${code}`));

    //     resolve();
    //   });
    // });

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
