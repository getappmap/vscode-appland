import * as vscode from 'vscode';
import { Finding } from '@appland/scanner';
import { resolveFilePath } from '../util';
import present from '../lib/present';
import ValueCache from '../lib/ValueCache';

class StackFrameIndex {
  locationByFrame = new Map<string, vscode.Location>();

  put(sourceUri: vscode.Uri, frame: string, location: vscode.Location): void {
    this.locationByFrame.set(StackFrameIndex.key(sourceUri, frame), location);
  }

  get(sourceUri: vscode.Uri, frame: string): vscode.Location | undefined {
    return this.locationByFrame.get(StackFrameIndex.key(sourceUri, frame));
  }

  static key(sourceUri: vscode.Uri, frame: string): string {
    return `${sourceUri.toString()}#${frame}`;
  }
}

const locationLabels = new ValueCache<ResolvedFinding, string | undefined>();
const groupDetailsCache = new ValueCache<ResolvedFinding, string | undefined>();

export class ResolvedFinding {
  public appMapUri?: vscode.Uri;
  public problemLocation?: vscode.Location;

  stackFrameIndex = new StackFrameIndex();

  constructor(public sourceUri: vscode.Uri, public finding: Finding) {}

  async initialize(): Promise<void> {
    await Promise.all(
      (this.finding.stack || []).map(async (path: string) => {
        if (this.stackFrameIndex.get(this.sourceUri, path)) return;

        const location = await ResolvedFinding.resolvePathLocation(this.sourceUri, path);
        if (location) this.stackFrameIndex.put(this.sourceUri, path, location);
      })
    );

    this.problemLocation = ResolvedFinding.preferredLocation(
      this.stackFrameIndex,
      this.sourceUri,
      this.finding
    );
    this.appMapUri = await ResolvedFinding.resolveAppMapUri(this.finding);
  }

  get locationLabel(): string | undefined {
    return locationLabels.getOrStore(this, () => {
      if (this.problemLocation) {
        let result = vscode.workspace.asRelativePath(this.problemLocation.uri.path);
        const line = this.problemLocation.range.start.line;
        if (line !== 0) result += `:${line}`;
        return result;
      }
    });
  }

  /**
   * Returns the finding details, suitable as a description of the finding group.
   * Trims the rule title from the beginning of the message, if present.
   */
  get groupDetails(): string | undefined {
    return groupDetailsCache.getOrStore(this, () => {
      const { ruleTitle } = this.finding;
      let message = this.finding.groupMessage || this.finding.message;
      if (message.startsWith(ruleTitle))
        message = message.substring(ruleTitle.length).replace(/^[:\s]+/, '');
      if (message.length > 0) return message;
    });
  }

  // Gets the preferred source Location of this finding. Source files which resolve relative to a workspace
  // are preferred over absolute paths.
  static preferredLocation(
    stackFrameIndex: StackFrameIndex,
    sourceUri: vscode.Uri,
    finding: Finding
  ): vscode.Location | undefined {
    const locations = (finding.stack || [])
      .map((frame: string) => stackFrameIndex.get(sourceUri, frame))
      .filter(present);

    const folderLocation = () => {
      return locations.find((location: vscode.Location) => {
        const folder = (vscode.workspace.workspaceFolders || []).find((folder) =>
          location.uri.fsPath.startsWith(folder.uri.fsPath)
        );
        if (!folder) return;

        return true;
      });
    };

    const anyLocation = () => locations.find(Boolean);

    return folderLocation() || anyLocation();
  }

  // Resolves an AppMap URI for a finding, examining the available workspaces.
  static async resolveAppMapUri(finding: Finding): Promise<vscode.Uri | undefined> {
    const filePaths = await Promise.all(
      (vscode.workspace.workspaceFolders || []).map((folder) =>
        resolveFilePath(folder.uri.fsPath, finding.appMapFile)
      )
    );
    const filePath = filePaths.find(Boolean);
    if (!filePath) return;

    const state = {
      currentView: 'viewFlow',
      selectedObject: `event:${finding.event.id}`,
    } as any; // eslint-disable-line @typescript-eslint/no-explicit-any

    if (finding.relatedEvents) {
      state.traceFilter = finding.relatedEvents.map((evt) => ['id', evt.id].join(':')).join(' ');
    }
    return vscode.Uri.parse(`file://${filePath}#${JSON.stringify(state)}`);
  }

  // Resolve a finding stack frame path into a vscode.Location, prepending the correct workspace folder path if needed.
  static async resolvePathLocation(
    sourceUri: vscode.Uri,
    path: string
  ): Promise<vscode.Location | undefined> {
    const folder = (vscode.workspace.workspaceFolders || []).find((folder) =>
      sourceUri.fsPath.startsWith(folder.uri.fsPath)
    );
    if (!folder) {
      console.warn(`No workspace folder matches finding source path ${sourceUri.fsPath}`);
      return;
    }

    const tokens = path.split(':', 2);
    const fileName = tokens[0];
    let line: string | number = 1;
    if (tokens.length > 1) line = tokens[1];
    const filePath = await resolveFilePath(folder.uri.fsPath, fileName);
    if (!filePath) return;

    return new vscode.Location(
      vscode.Uri.file(filePath),
      new vscode.Range(
        new vscode.Position(Number(line) - 1, 0),
        new vscode.Position(Number(line) - 1, Number.MAX_VALUE)
      )
    );
  }
}