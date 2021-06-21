import { equal } from 'assert';

// You can import and use all API from the 'vscode' module
// as well as import your extension to test it
import { window } from 'vscode';
// const myExtension = require('../extension');

suite('Extension Test Suite', () => {
  window.showInformationMessage('Start all tests.');

  test('Sample test', () => {
    equal(-1, [1, 2, 3].indexOf(5));
    equal(-1, [1, 2, 3].indexOf(0));
  });
});
