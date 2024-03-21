import * as vscode from 'vscode';

export default class ExitSurveyWebview {
  private static panelId = 'appmap.exitSurvey';
  private static panelTitle = 'Help us improve AppMap';
  private static existingPanel?: vscode.WebviewPanel;

  public static register(context: vscode.ExtensionContext): void {
    context.subscriptions.push(
      vscode.commands.registerCommand('appmap.exitSurvey', async () => {
        // Attempt to re-use an existing webview for this project if one exists
        if (this.existingPanel) {
          this.existingPanel.reveal(vscode.ViewColumn.Two);
          return;
        }

        const panel = vscode.window.createWebviewPanel(
          ExitSurveyWebview.panelId,
          ExitSurveyWebview.panelTitle,
          vscode.ViewColumn.Two,
          {
            enableScripts: true,
            retainContextWhenHidden: true,
          }
        );

        this.existingPanel = panel;
        panel.webview.html = `
        <!DOCTYPE html>
        <html lang="en">
          <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <meta http-equiv="Content-Security-Policy" content="">
            <style>
              html, body, iframe {
                width: 100%;
                height: 100%;
                padding: 0;
              }
            </style>
          </head>
          <body style="background-color: #bfbfbf">
            <iframe src="https://docs.google.com/forms/d/e/1FAIpQLSdZYMMD8KBcIzLP4b_0KXR9JJhsFEfM6GzTi2sW4bGwKWQsHQ/viewform?embedded=true" frameborder="0" marginheight="0" marginwidth="0">Loading…</iframe>
          </body>
        </html>`;

        panel.onDidDispose(() => {
          this.existingPanel = undefined;
        });
      })
    );
  }
}
