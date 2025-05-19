import * as vscode from 'vscode';
import { Check, Finding, ImpactDomain, Rule } from '@appland/scanner';
import { resolveFilePath } from '../util';
import present from '../lib/present';
import ValueCache from '../lib/ValueCache';
import assert from 'assert';
import { warn } from 'console';

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

function lessThanDaysAgo(days: number): (finding: Finding) => boolean {
  return (finding: Finding) => {
    const modifiedDate = finding.eventsModifiedDate || finding.scopeModifiedDate;
    if (!modifiedDate) return false;

    const cutoff = new Date(new Date().getTime() - days * 24 * 60 * 60 * 1000);
    return new Date(modifiedDate) >= cutoff;
  };
}

function moreThanDaysAgo(days: number): (finding: Finding) => boolean {
  return (finding: Finding) => {
    const modifiedDate = finding.eventsModifiedDate || finding.scopeModifiedDate;
    if (!modifiedDate) return false;

    const cutoff = new Date(new Date().getTime() - days * 24 * 60 * 60 * 1000);
    return new Date(modifiedDate) < cutoff;
  };
}

function noDateIndicated(finding: Finding): boolean {
  const modifiedDate = finding.eventsModifiedDate || finding.scopeModifiedDate;
  return modifiedDate === undefined;
}

export type DateBucket = {
  label: string;
  expanded?: boolean;
  icon?: string;
  filter: (finding: Finding) => boolean;
};

export const DATE_BUCKETS: DateBucket[] = [
  { label: 'Last 24 hours', filter: lessThanDaysAgo(1), expanded: true, icon: 'bell' },
  { label: 'Last 7 days', filter: lessThanDaysAgo(7) },
  { label: 'Last 30 days', filter: lessThanDaysAgo(30) },
  { label: 'More than 30 days ago', filter: moreThanDaysAgo(30) },
  { label: 'No date indicated', filter: noDateIndicated },
];

export class ResolvedFinding {
  constructor(
    public sourceUri: vscode.Uri,
    public finding: Finding,
    public checks: Check[],
    public folder: vscode.WorkspaceFolder,
    public appMapUri: vscode.Uri,
    public dateBucket: DateBucket,
    public rule: Rule,
    public stackFrameIndex: StackFrameIndex,
    public problemLocation?: vscode.Location
  ) {}

  static async resolve(
    folder: vscode.WorkspaceFolder,
    sourceUri: vscode.Uri,
    finding: Finding,
    checks: Check[]
  ): Promise<ResolvedFinding | undefined> {
    const stackFrameIndex = new StackFrameIndex();

    await Promise.all(
      (finding.stack || []).map(async (path: string) => {
        if (stackFrameIndex.get(sourceUri, path)) return;

        const location = await ResolvedFinding.resolvePathLocation(sourceUri, path);
        if (location) stackFrameIndex.put(sourceUri, path, location);
      })
    );

    const rule = checks.find((check) => check.id === finding.checkId)?.rule;
    if (!rule) {
      warn(`No rule found for check ${finding.checkId}`);
      return;
    }
    const dateBucket = DATE_BUCKETS.find((bucket) => bucket.filter(finding));
    // There should always be a fallback bucket
    assert(dateBucket);
    const problemLocation = ResolvedFinding.preferredLocation(stackFrameIndex, sourceUri, finding);
    const appMapUri = await ResolvedFinding.resolveAppMapUri(finding);
    if (!appMapUri) return;

    return new ResolvedFinding(
      sourceUri,
      finding,
      checks,
      folder,
      appMapUri,
      dateBucket,
      rule,
      stackFrameIndex,
      problemLocation
    );
  }

  get impactDomain(): ImpactDomain | undefined {
    assert(this.rule);
    return this.rule.impactDomain;
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

    const uri = vscode.Uri.file(filePath);
    return uri.with({ fragment: JSON.stringify(state) });
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
    let line = 1;
    if (tokens.length > 1) {
      const parsedLine = parseInt(tokens[1], 10);
      if (!isNaN(parsedLine) && parsedLine > 0) {
        line = parsedLine;
      } else {
        console.warn(`Invalid line number in finding stack frame: ${tokens[1]}, falling back to 1`);
      }
    }
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
