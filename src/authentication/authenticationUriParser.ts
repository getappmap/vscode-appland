import { Uri } from 'vscode';

export default class AuthenticationUriParser<T extends { new (...args: any[]): T }> {
  constructor(public readonly provider: string, protected readonly type: T) {}

  handleUri(uri: Uri): Partial<T> {
    const payload = new this.type();
    const queryParams = new URLSearchParams(uri.query);
    Object.entries(queryParams).forEach(([k, v]) => {
      payload[k] = v;
    });
    return payload;
  }
}
