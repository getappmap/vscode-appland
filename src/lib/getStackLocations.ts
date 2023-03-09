import * as vscode from 'vscode';
import { ResolvedFinding } from '../services/resolvedFinding';

export type StackLocation = vscode.Location & {
  truncatedPath: string;
};

const STACK_TRACE_CHARACTER_LIMIT = 50;

export function getStackLocations(finding: ResolvedFinding): StackLocation[] {
  const stackFrameIndex = finding.stackFrameIndex;
  return Array.from(stackFrameIndex.locationByFrame.values()).map((location) => {
    let truncatedPath = location.uri.path;
    const splitPath = location.uri.path.split('/');

    while (truncatedPath.length > STACK_TRACE_CHARACTER_LIMIT) {
      splitPath.shift();
      truncatedPath = splitPath.join('/');
    }
    truncatedPath = `...${'/'}${truncatedPath}`;

    return { ...location, truncatedPath };
  });
}
