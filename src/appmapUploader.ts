import * as vscode from 'vscode';
import bent from 'bent';

export class AppmapUploader {
  private static DIALOG_KEY = 'applandinc.appmap.uploadDialog';

  public static async upload(
    appMapFile: vscode.TextDocument,
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

    const post = bent(this.getUri().toString(), 'POST', 'json', 201, {
      'X-Requested-With': 'VSCodeUploader',
    });

    try {
      const response = (await post('api/appmaps/create_upload', {
        data: appMapFile.getText(),
      })) as {
        id: number;
        token: string;
      };

      const confirmUri = this.getConfirmUri(response.id, response.token);

      vscode.env.openExternal(confirmUri);

      vscode.window.showInformationMessage(`Uploaded ${appMapFile.fileName}`);

      return true;
    } catch (e) {
      vscode.window.showErrorMessage(`Upload failed: ${e.name}: ${e.message}`);
    }

    return false;
  }

  public static resetState(context: vscode.ExtensionContext): void {
    context.globalState.update(this.DIALOG_KEY, undefined);
  }

  private static getUri(): vscode.Uri {
    const configUrl: string = vscode.workspace
      .getConfiguration('appMap')
      .get('applandUrl') as string;
    return vscode.Uri.parse(configUrl);
  }

  private static getConfirmUri(id: number, token: string): vscode.Uri {
    return vscode.Uri.joinPath(this.getUri(), '/scenario_uploads', id.toString()).with({
      query: `token=${token}`,
    });
  }
}
