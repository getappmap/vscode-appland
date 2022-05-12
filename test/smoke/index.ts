import * as path from 'path';
import * as temp from 'temp';
import glob from 'glob';
import Mocha from 'mocha';

function run(): Promise<void> {
  // Create the mocha test
  const mocha = new Mocha({
    ui: 'bdd',
    color: true,
    timeout: '120s',
  });

  temp.track();

  const testPath = process.env.TEST_PATH ? process.env.TEST_PATH : '**/*.test.js';
  console.log(`Loading tests ${testPath} within ${__dirname}`);
  return new Promise((resolve, reject) => {
    glob(testPath, { cwd: __dirname }, (err, files) => {
      if (err) {
        return reject(err);
      }

      // Add files to the test suite
      files.forEach((f) => {
        console.log(f, path.resolve(__dirname, f));
        mocha.addFile(path.resolve(__dirname, f));
      });

      try {
        // Run the mocha test
        mocha.run((failures) => {
          if (failures > 0) {
            reject(new Error(`${failures} tests failed.`));
          } else {
            resolve();
          }
        });
      } catch (exception) {
        console.error(exception);
        reject(exception);
      }
    });
  });
}

module.exports = {
  run,
};
