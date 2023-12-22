import { Uri } from 'vscode';

export default class CodeAction {
  public command: Record<string, string | Uri | string[] | Uri[]> | undefined;

  constructor(public readonly title: string, public readonly kind: string) {}
}
