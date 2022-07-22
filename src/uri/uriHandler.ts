import * as vscode from 'vscode';

export interface RequestHandler extends vscode.Disposable {
  path: string;
  params?: Record<string, string>;
  handle(queryParams: URLSearchParams): void | Promise<void>;
}

export default class UriHandler implements vscode.UriHandler, vscode.Disposable {
  protected handlers: { [key: string]: RequestHandler[] } = {};

  registerHandler(handler: RequestHandler): void {
    if (handler.path in this.handlers) {
      this.handlers[handler.path].push(handler);
    } else {
      this.handlers[handler.path] = [handler];
    }
  }

  registerHandlers(...handlers: RequestHandler[]): void {
    handlers.forEach((handler) => this.registerHandler(handler));
  }

  handleUri(uri: vscode.Uri): vscode.ProviderResult<void> {
    const targetHandlers = this.handlers[uri.path];
    const queryParams = new URLSearchParams(uri.query);
    targetHandlers
      .filter(
        (handler) =>
          !handler.params ||
          Object.entries(handler.params).every(([k, v]) => queryParams.get(k) === v)
      )
      .forEach((handler) => handler.handle(queryParams));
  }

  dispose(): void {
    Object.values(this.handlers)
      .flat()
      .forEach((d) => d.dispose());
  }
}
