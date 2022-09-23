import * as vscode from 'vscode';
import extensionSettings from '../configuration/extensionSettings';
import AppMapDocument from '../editor/AppMapDocument';
import { AppMap, loadConfiguration } from '@appland/client';
import { UploadAppMapResponse } from '@appland/client/dist/src/appMap';
import { AUTHN_PROVIDER_NAME } from '../authentication/appmapServerAuthenticationProvider';

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
          `To share your AppMap, it will be uploaded to AppMap Server.`,
          `It will be identified by a secure, unguessable link.`,
          `By default, anyone with the link will be able to see the AppMap`,
          `You can manage the sharing settings on the AppMap Server page for your AppMap.`,
          '',
          `If you haven't logged in to AppMap Server from VSCode before, you'll be`,
          `doing that next.`,
        ].join(' '),
        'OK'
      );

      if (!result) {
        return false;
      }

      context.globalState.update(this.DIALOG_KEY, true);
    }

    const session = await vscode.authentication.getSession(AUTHN_PROVIDER_NAME, ['default'], {
      createIfNone: true,
    });
    if (!session) {
      return false;
    }

    let upload: UploadAppMapResponse;
    try {
      upload = await AppMap.create(Buffer.from(appMapFile.raw), {});
    } catch (e) {
      const err = e as Error;
      vscode.window.showErrorMessage(
        `Upload failed (${loadConfiguration()}) ${err.name}: ${err.message}`
      );
      return false;
    }

    const appMapURL = vscode.Uri.joinPath(
      extensionSettings.appMapServerURL(),
      'scenarios',
      upload.uuid
    );
    // TODO: Open the AppMap with the current configured state
    // .with({
    //   query: `state=${appMapState}`,
    // });

    vscode.env.clipboard.writeText(appMapURL.toString());
    vscode.window.showInformationMessage(`AppMap URL is on the clipboard`);
    return true;
  }

  public static resetState(context: vscode.ExtensionContext): void {
    context.globalState.update(this.DIALOG_KEY, undefined);
  }
}
