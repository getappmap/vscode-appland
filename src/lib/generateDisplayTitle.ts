import { ResolvedFinding } from '../services/resolvedFinding';
import * as vscode from 'vscode';

// Gets's name displayed in Findings bar
export default (finding: ResolvedFinding): string => {
  const absPath = finding.problemLocation?.uri.path;
  const relPath = absPath ? vscode.workspace.asRelativePath(absPath) : undefined;

  const rule = finding.finding.ruleTitle;
  const context = finding.finding.groupMessage || finding.finding.message;
  const lineno = finding.problemLocation?.range.start.line;

  // If rule and context are the same, only display one
  const ruleAndContext =
    rule !== context && !context.startsWith(rule) ? `${rule}: ${context}` : context;

  // Only display problemLocation if it exists
  const fullPathString = finding.problemLocation ? `, ${relPath}:${lineno}` : '';

  return `${ruleAndContext}${fullPathString}`;
};
