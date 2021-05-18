import * as vscode from 'vscode';
import * as bent from 'bent';

export default class RemoteRecording {
  private static readonly RECORDING_URI = '/_appmap/record';
  private static async getBaseUrl(): Promise<string | undefined> {
    return await vscode.window.showInputBox({
      placeHolder: 'URL of remote recording server, eg "http://localhost:3000"',
    });
  }
  static async start(): Promise<void> {
    const baseURL = (await this.getBaseUrl()) || '';
    const request = bent(baseURL, 'POST', 'json', 200);

    try {
      await request(this.RECORDING_URI);
      vscode.window.showInformationMessage(`Recording started at "${baseURL}"`);
    } catch (e) {
      vscode.window.showErrorMessage(`Start recording failed: ${e.name}: ${e.message}`);
    }
  }
  static async getStatus(): Promise<void> {
    const baseURL = (await this.getBaseUrl()) || '';
    const request = bent(baseURL, 'GET', 'json', 200);

    try {
      const response = (await request(this.RECORDING_URI)) as {
        enabled: boolean;
      };
      const recordingStatus = response.enabled ? 'enabled' : 'disabled';
      vscode.window.showInformationMessage(`Recording status at "${baseURL}": ${recordingStatus}`);
    } catch (e) {
      vscode.window.showErrorMessage(`Recording status failed: ${e.name}: ${e.message}`);
    }
  }
  static async stop(): Promise<void> {
    const baseURL = (await this.getBaseUrl()) || '';
    const request = bent(baseURL, 'DELETE', 'json', 200);

    try {
      const response = (await request(this.RECORDING_URI)) as string;

      const document = await vscode.workspace.openTextDocument({
        language: undefined,
        content: JSON.stringify(response),
      });
      vscode.window.showTextDocument(document);

      vscode.window.showInformationMessage(`Recording stopped at "${baseURL}"`);
    } catch (e) {
      vscode.window.showErrorMessage(`Stop recording failed: ${e.name}: ${e.message}`);
    }
  }
}
