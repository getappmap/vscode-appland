const assert = require('assert');

// You can import and use all API from the 'vscode' module
// as well as import your extension to test it
const vscode = require('vscode');
// const myExtension = require('../extension');

suite('Extension Test Suite', () => {
	vscode.window.showInformationMessage('Start all tests.');

	test('Opens an AppMap file', (done) => {
		vscode.workspace.findFiles('**/*.appmap.json')
			.then((uris) => {
				const appMapFile = uris[0];
				vscode.commands.executeCommand('vscode.open', appMapFile)
					.then(done, (err) => {
						done(new Error(err));
					})
			});
	}).timeout(0);
});
