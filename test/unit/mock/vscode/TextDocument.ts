import { URI } from 'vscode-uri';
import Range from './Range';

export default class TextDocument {
  uri: URI;
  lines: string[];

  constructor(public readonly filename: string, public readonly text: string) {
    this.uri = URI.file(filename);
    this.lines = text.split('\n');
  }

  getText(range?: Range): string {
    if (range) {
      const startLineIndex = range.start.line;
      const endLineIndex = range.end.line;
      const startLine = this.lines[startLineIndex];
      const endLine = this.lines[endLineIndex];
      const startChar = range.start.character;
      const endChar = range.end.character;
      if (startLineIndex === endLineIndex) {
        return startLine.substring(startChar, endChar);
      } else {
        return [
          startLine.substring(startChar),
          ...this.lines.slice(startLineIndex + 1, endLineIndex),
          endLine.substring(0, endChar),
        ].join('\n');
      }
    } else {
      return this.text;
    }
  }
}
