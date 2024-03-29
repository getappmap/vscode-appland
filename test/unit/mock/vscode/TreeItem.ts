export default class TreeItem {
  public contextValue: string | undefined;
  public iconPath: string | undefined;
  public tooltip: string | undefined;
  public command: unknown | undefined;

  constructor(public label: string, public collapsibleState: number) {}
}
