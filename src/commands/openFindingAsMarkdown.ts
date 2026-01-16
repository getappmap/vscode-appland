import * as vscode from 'vscode';
import * as path from 'path';
import { FindingTreeItem } from '../tree/findingsTreeDataProvider';
import { RawEventData } from '../types/rawEvent';

const MAX_STACK_FRAMES = 5;
const MESSAGE_WIDTH = 100;

function wordWrap(text: string, maxWidth: number): string {
  const lines: string[] = [];
  const paragraphs = text.split('\n');

  for (const paragraph of paragraphs) {
    if (paragraph.trim().length === 0) {
      lines.push('');
      continue;
    }

    const words = paragraph.split(/\s+/);
    let currentLine = '';

    for (const word of words) {
      const testLine = currentLine.length === 0 ? word : `${currentLine} ${word}`;

      if (testLine.length <= maxWidth) {
        currentLine = testLine;
      } else {
        if (currentLine.length > 0) {
          lines.push(currentLine);
        }
        currentLine = word;
      }
    }

    if (currentLine.length > 0) {
      lines.push(currentLine);
    }
  }

  return lines.join('\n');
}

function createFileLink(stackFrame: string, workspaceFolder: vscode.WorkspaceFolder): string {
  // Parse format: "path/to/file.ts:42" or "path/to/file.ts" or "path/to/file.ts:-1"
  const match = stackFrame.match(/^(.+?)(?::(-?\d+))?$/);
  if (!match) return stackFrame;

  const [, filePath, lineStr] = match;
  let lineNumber: number | null = null;

  // Parse and validate line number
  if (lineStr) {
    const parsedLine = parseInt(lineStr, 10);
    // Only use line number if it's a positive integer (>= 1)
    if (parsedLine >= 1) {
      lineNumber = parsedLine;
    }
  }

  // Resolve to absolute path first
  const absolutePath = path.isAbsolute(filePath)
    ? filePath
    : path.join(workspaceFolder.uri.fsPath, filePath);

  // Convert to workspace-relative path for both display and link
  const relativePath = vscode.workspace.asRelativePath(absolutePath);

  // Create link URL (workspace-relative with line number fragment if present)
  const linkUrl = lineNumber ? `${relativePath}#L${lineNumber}` : relativePath;

  // Create display text (with line number after colon if present)
  const displayText = lineNumber ? `${relativePath}:${lineNumber}` : relativePath;

  return `[${displayText}](${linkUrl})`;
}

function formatFindingSynopsis(
  findingTreeItem: FindingTreeItem,
  workspaceFolder: vscode.WorkspaceFolder
): string {
  const resolvedFinding = findingTreeItem.finding;
  const finding = resolvedFinding.finding;

  // Build synopsis in markdown format
  const parts: string[] = [];

  // Header with rule title
  parts.push(`# ${finding.ruleTitle}`);
  parts.push('');

  // Rule ID
  parts.push(`This AppMap matches the following analysis rule: \`${finding.ruleId}\``);
  parts.push('');

  // Rule description
  if (resolvedFinding.rule.description) {
    parts.push(resolvedFinding.rule.description);
    parts.push('');
  }

  // Impact domain and occurrence count
  const metadata: string[] = [];
  if (resolvedFinding.impactDomain) {
    metadata.push(`**Impact Domain**: ${resolvedFinding.impactDomain}`);
  }
  if (finding.occurranceCount && finding.occurranceCount > 1) {
    metadata.push(`**Occurrences**: ${finding.occurranceCount}`);
  }
  if (metadata.length > 0) {
    parts.push(metadata.join(' | '));
    parts.push('');
  }

  // Message (word-wrapped in code block)
  parts.push(`## Finding Details`);
  parts.push('```');
  parts.push(wordWrap(finding.message, MESSAGE_WIDTH));
  parts.push('```');
  parts.push('');

  // Group message if different from main message
  if (finding.groupMessage && finding.groupMessage !== finding.message) {
    parts.push(`## Group Summary`);
    parts.push('```');
    parts.push(wordWrap(finding.groupMessage, MESSAGE_WIDTH));
    parts.push('```');
    parts.push('');
  }

  // Source location
  if (resolvedFinding.locationLabel) {
    parts.push(`## Source Location`);
    parts.push(createFileLink(resolvedFinding.locationLabel, workspaceFolder));
    parts.push('');
  }

  // Stack trace (top N frames)
  if (finding.stack && finding.stack.length > 0) {
    parts.push(`## Stack Trace`);
    const stackFrames = finding.stack.slice(0, MAX_STACK_FRAMES);
    stackFrames.forEach((frame) => {
      parts.push(`- ${createFileLink(frame, workspaceFolder)}`);
    });
    if (finding.stack.length > MAX_STACK_FRAMES) {
      parts.push(`- ... (${finding.stack.length - MAX_STACK_FRAMES} more frames)`);
    }
    parts.push('');
  }

  // Participating events if available
  // Note: participatingEvents is incorrectly typed as Event in @appland/scanner,
  // but actually contains raw JSON data with snake_case properties
  if (finding.participatingEvents && Object.keys(finding.participatingEvents).length > 0) {
    const rawEvents = finding.participatingEvents as unknown as Record<string, RawEventData>;
    parts.push(`## Code Event Context`);
    for (const [name, rawEvent] of Object.entries(rawEvents)) {
      const event: RawEventData = rawEvent;
      // Add event type/method if available
      if (event.http_server_request) {
        const req = event.http_server_request;
        const normalizedPath =
          req.normalized_path_info && req.normalized_path_info !== req.path_info
            ? ` (${req.normalized_path_info})`
            : '';
        parts.push(`- **${name}**: ${req.request_method} ${req.path_info}${normalizedPath}`);
      } else if (event.sql_query) {
        parts.push(`- **${name}** (SQL):`);
        parts.push('  ```sql');
        parts.push(`  ${event.sql_query.sql || 'N/A'}`);
        parts.push('  ```');
        if (event.sql_query.database_type) {
          parts.push(`  Database: ${event.sql_query.database_type}`);
        }
      } else {
        const location = [event.defined_class, event.static ? '.' : '#', event.method_id]
          .filter(Boolean)
          .join('');
        parts.push(`- **${name}**: ${location}`);
      }
    }
    parts.push('');
  }

  // AppMap file (workspace-relative path as clickable link)
  const workspaceRelativePath = vscode.workspace.asRelativePath(resolvedFinding.appMapUri.fsPath);
  parts.push(`## AppMap`);
  parts.push(`[${workspaceRelativePath}](${workspaceRelativePath})`);
  parts.push('');

  // References
  parts.push(`## References`);
  if (resolvedFinding.rule.references && Object.keys(resolvedFinding.rule.references).length > 0) {
    parts.push(`- ${resolvedFinding.rule.url}`);
    for (const [name, url] of Object.entries(resolvedFinding.rule.references)) {
      parts.push(`- [${name}](${url.toString()})`);
    }
    parts.push('');
  }

  return parts.join('\n');
}

export default function registerCommand(context: vscode.ExtensionContext): void {
  context.subscriptions.push(
    vscode.commands.registerCommand(
      'appmap.openFindingAsMarkdown',
      async (findingTreeItem: FindingTreeItem) => {
        try {
          // Get workspace folder for resolving relative paths
          const workspaceFolder = findingTreeItem.finding.folder;
          const synopsis = formatFindingSynopsis(findingTreeItem, workspaceFolder);

          // Create untitled markdown document
          const document = await vscode.workspace.openTextDocument({
            content: synopsis,
            language: 'markdown',
          });

          // Show the document first (required for preview command to work)
          await vscode.window.showTextDocument(document);

          // Then open the markdown preview
          await vscode.commands.executeCommand('markdown.showPreview', document.uri);
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : String(error);
          vscode.window.showErrorMessage(`Failed to open finding as markdown: ${errorMessage}`);
          console.error('Open finding as markdown error:', error);
        }
      }
    )
  );
}
