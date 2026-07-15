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

  // TEST_FILES is a JSON array of absolute test paths sharing one workspace (they run in a
  // single Electron instance). TEST_FILE remains supported for a single file.
  const testFilesEnv = process.env.TEST_FILES;
  const testFile = process.env.TEST_FILE;
  const testFiles: string[] = testFilesEnv ? JSON.parse(testFilesEnv) : testFile ? [testFile] : [];
  if (testFiles.length === 0) {
    throw new Error(`Expecting TEST_FILES or TEST_FILE env var to indicate which tests to run`);
  }

  const resolvedTestFiles: string[] = [];
  for (const file of testFiles) {
    const resolved = path.resolve(__dirname, file);
    if (!(await promisify(exists)(resolved))) {
      throw new Error(`Test file ${resolved} does not exist`);
    }
    resolvedTestFiles.push(resolved);
  }

  return new Promise((resolve, reject) => {
    resolvedTestFiles.forEach((file) => mocha.addFile(file));
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
