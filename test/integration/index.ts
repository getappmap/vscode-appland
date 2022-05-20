import * as path from 'path';
import * as temp from 'temp';
import Mocha from 'mocha';

function run(): Promise<void> {
  // Create the mocha test
  const mocha = new Mocha({
    ui: 'bdd',
    color: true,
    timeout: '120s',
  });

  temp.track();

  const testFile = process.env.TEST_FILE;
  if (!testFile) {
    throw new Error(`Expecting TEST_FILE env var to indicate which test to run`);
  }

  return new Promise((resolve, reject) => {
    mocha.addFile(path.resolve(__dirname, testFile));
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
}

module.exports = {
  run,
};
