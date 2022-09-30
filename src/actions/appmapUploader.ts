import * as vscode from 'vscode';
import extensionSettings from '../configuration/extensionSettings';
import { AppMap } from '@appland/client';
import { UploadAppMapResponse } from '@appland/client/dist/src/appMap';
import { AUTHN_PROVIDER_NAME } from '../authentication';

export class AppmapUploader {
  public static DIALOG_KEY = 'applandinc.appmap.uploadDialog';

  private static async userAcceptedTerms(context: vscode.ExtensionContext): Promise<boolean> {
    const acceptedPreviously = context.globalState.get<boolean>(AppmapUploader.DIALOG_KEY);
    if (!acceptedPreviously) {
      const result = await vscode.window.showInformationMessage(
        [
          'Your AppMap will be uploaded to AppMap Server for sharing. ',
          'Your map will have an unguessable link.',
          'By default, anyone with the link will be able to view the AppMap in their browser.',
          'You can manage the sharing settings on the AppMap Server page for each AppMap.',
          "If you are not logged in to AppMap Server from VS Code before, you'll be prompted",
          'to log in or sign up first.',
        ].join(' '),
        'OK'
      );

      if (!result) {
        return false;
      }

      context.globalState.update(AppmapUploader.DIALOG_KEY, true);
    }
    return true;
  }

  public static async upload(
    appmapData: Buffer,
    context: vscode.ExtensionContext,
    viewState?: string
  ): Promise<boolean> {
    if (!(await this.userAcceptedTerms(context))) {
      return false;
    }

    const session = await vscode.authentication.getSession(AUTHN_PROVIDER_NAME, ['default'], {
      createIfNone: true,
    });
    if (!session) {
      return false;
    }

    let upload: UploadAppMapResponse;
    try {
      upload = await AppMap.create(appmapData, { public: true });
    } catch (e) {
      const err = e as Error;
      vscode.window.showErrorMessage(`Upload failed: ${String(err)}`);
      return false;
    }

    let appMapURL = vscode.Uri.joinPath(
      extensionSettings.appMapServerURL,
      'scenarios',
      upload.uuid
    ).toString();

    if (viewState) {
      appMapURL += `?state=${viewState}`;
    }

    await vscode.env.clipboard.writeText(appMapURL);
    vscode.window.showInformationMessage(`A link to the AppMap has been copied to the clipboard.`);

    return true;
  }

  public static resetState(context: vscode.ExtensionContext): void {
    context.globalState.update(this.DIALOG_KEY, undefined);
  }
}
