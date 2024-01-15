import * as vscode from 'vscode';

export default class WebviewList {
  public readonly panels = new Set<vscode.WebviewPanel>();

  enroll(panel: vscode.WebviewPanel): void {
    this.panels.add(panel);
    panel.onDidDispose(() => this.panels.delete(panel));
  }

  get webviews(): vscode.Webview[] {
    return [...this.panels.values()].map((panel) => panel.webview);
  }

  get currentWebview(): vscode.Webview | undefined {
    const panel = [...this.panels.values()].find((panel) => panel.active);
    if (!panel) return;

    return panel.webview;
  }
}
