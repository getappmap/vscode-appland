import * as path from 'path';
import glob from 'glob';
import Mocha from 'mocha';

function run(): Promise<void> {
  // Create the mocha test
  const mocha = new Mocha({
    ui: 'tdd',
    color: true,
  });

  return new Promise((resolve, reject) => {
    glob('**/**.test.js', { cwd: __dirname }, (err, files) => {
      if (err) {
        return reject(err);
      }

      // Add files to the test suite
      files.forEach((f) => mocha.addFile(path.resolve(__dirname, f)));

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
