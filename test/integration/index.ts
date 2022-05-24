import * as path from 'path';
import * as temp from 'temp';
import Mocha from 'mocha';
import { promisify } from 'util';
import { exists } from 'fs';

async function run(): Promise<void> {
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
  const resolvedTestFile = path.resolve(__dirname, testFile);
  if (!(await promisify(exists)(resolvedTestFile))) {
    throw new Error(`TEST_FILE ${resolvedTestFile} does not exist`);
  }

  return new Promise((resolve, reject) => {
    mocha.addFile(resolvedTestFile);
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
