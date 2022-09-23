import * as vscode from 'vscode';
import extensionSettings from '../configuration/extensionSettings';
import AppMapDocument from '../editor/AppMapDocument';
import { AppMap } from '@appland/client';
import { UploadCreateAppMapResponse } from '@appland/client/dist/src/appMap';
import assert from 'assert';

export class AppmapUploader {
  private static DIALOG_KEY = 'applandinc.appmap.uploadDialog';

  public static async upload(
    appMapFile: AppMapDocument,
    context: vscode.ExtensionContext
  ): Promise<boolean> {
    const acceptedPreviously = context.globalState.get<boolean>(this.DIALOG_KEY);
    if (!acceptedPreviously) {
      const result = await vscode.window.showInformationMessage(
        [
          'Performing this action will upload this AppMap to the AppLand cloud where it can be easily shared.',
          'By continuing, you agree that you have permission to distribute the data contained in this AppMap.',
          'If you choose to continue, this dialog will not appear again.',
        ].join(' '),
        'Continue',
        'Cancel'
      );

      if (!result || result === 'Cancel') {
        return false;
      }

      context.globalState.update(this.DIALOG_KEY, true);
    }

    let upload: UploadCreateAppMapResponse;
    try {
      upload = await AppMap.createUpload(Buffer.from(appMapFile.raw), {});
    } catch (e) {
      const err = e as Error;
      vscode.window.showErrorMessage(`Upload failed: ${err.name}: ${err.message}`);
      return false;
    }

    if (upload.completed) {
      const appMapURL = vscode.Uri.joinPath(
        extensionSettings.appMapServerURL(),
        'appmaps',
        upload.completed.uuid
      );
      // TODO: Open the AppMap with the current configured state
      // .with({
      //   query: `state=${appMapState}`,
      // });

      vscode.env.clipboard.writeText(appMapURL.toString());
      vscode.window.showInformationMessage(`AppMap URL is on the clipboard`);
      return true;
    } else {
      assert(upload.pending, `Upload should be pending if it's not completed`);
      const confirmUri = this.getConfirmUri(
        upload.pending.upload_id.toString(),
        upload.pending.token
      );
      vscode.env.openExternal(confirmUri);
    }

    return true;
  }

  public static resetState(context: vscode.ExtensionContext): void {
    context.globalState.update(this.DIALOG_KEY, undefined);
  }

  private static getConfirmUri(id: string, token: string): vscode.Uri {
    return vscode.Uri.joinPath(
      extensionSettings.appMapServerURL(),
      '/scenario_uploads',
      id.toString()
    ).with({
      query: `token=${token}`,
    });
  }
}
