import * as vscode from 'vscode';

import { readFile } from 'fs/promises';
import { fileExists } from '../util';
import { join } from 'path';

const SYMBOL_KINDS = [
  vscode.SymbolKind.Class,
  vscode.SymbolKind.Function,
  vscode.SymbolKind.Method,
  vscode.SymbolKind.Struct,
];

export default async function lookupSourceCode(
  directory: string,
  location: string
): Promise<string | undefined> {
  const [path, lineNoStr] = location.split(':');

  const fileName = join(directory, path);
  if (!(await fileExists(fileName))) return;

  const fileContent = await readFile(fileName, 'utf-8');
  if (!lineNoStr) return fileContent;

  const lineNo = parseInt(lineNoStr, 10);

  const symbols: vscode.DocumentSymbol[] =
    (await vscode.commands.executeCommand(
      'vscode.executeDocumentSymbolProvider',
      vscode.Uri.file(fileName)
    )) || [];

  const symbolRanges = new Array<vscode.Range>();

  // Collect all symbol ranges that contain the line number. Limit the results to
  // classes, functions, methods, and structs. Smaller symbols such as Enum, Variable,
  // Constant, etc are too fine grained to be useful.
  // Subsequently, the smallest symbol range will be selected from among the candidates.
  const collectSymbolRange = (symbol: vscode.DocumentSymbol): void => {
    const { kind } = symbol;
    if (SYMBOL_KINDS.includes(kind)) {
      const { range } = symbol;

      if (range.start.line <= lineNo && range.end.line >= lineNo) symbolRanges.push(range);
    }

    symbol.children.forEach(collectSymbolRange);
  };
  symbols.forEach(collectSymbolRange);

  const smallestSymbolRange = (): string | undefined => {
    if (symbolRanges.length === 0) return;

    symbolRanges.sort((a, b) => a.start.line - b.start.line);
    const smallestSymbolRange = symbolRanges[0];
    return fileContent
      .split('\n')
      .slice(smallestSymbolRange.start.line - 1, smallestSymbolRange.end.line)
      .join('\n');
  };

  const fileContentSnippet = (): string | undefined => {
    const lines = fileContent.split('\n');
    const start = Math.max(0, lineNo - 1);
    const end = Math.min(lines.length, lineNo + 10);
    return lines.slice(start, end).join('\n');
  };

  return smallestSymbolRange() || fileContentSnippet();
}
