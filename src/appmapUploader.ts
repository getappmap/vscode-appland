import * as vscode from 'vscode';
import * as bent from 'bent';

export class AppmapUploader {
  public static async upload(appMapFile: vscode.TextDocument): Promise<void> {
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
    } catch (e) {
      vscode.window.showErrorMessage(`Upload failed: ${e.name}: ${e.message}`);
    }
  }

  private static getUri(): vscode.Uri {
    const configUrl: string = vscode.workspace
      .getConfiguration('appMap')
      .get('appLandURL') as string;
    return vscode.Uri.parse(configUrl);
  }

  private static getConfirmUri(id: number, token: string): vscode.Uri {
    return vscode.Uri.joinPath(this.getUri(), '/scenario_uploads', id.toString()).with({
      query: `token=${token}`,
    });
  }
}
