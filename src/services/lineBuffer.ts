// Accumulates chunks of text and yields complete lines as they become available, without ever
// re-returning a line once it has been consumed. Guards against unbounded growth if a very long
// line arrives with no trailing newline.
export default class LineBuffer {
  private buffer = '';

  constructor(private readonly maxLength = 1024) {}

  // Feed a chunk of text in; returns any complete (trimmed) lines it produced.
  push(data: string): string[] {
    this.buffer += data;

    const lines: string[] = [];
    let lineEnd: number;
    while ((lineEnd = this.buffer.indexOf('\n')) !== -1) {
      lines.push(this.buffer.slice(0, lineEnd).trim());
      this.buffer = this.buffer.slice(lineEnd + 1);
    }

    // Defensive truncation to prevent memory leaks in case of an extremely long continuous
    // string with no newline characters.
    if (this.buffer.length > this.maxLength) {
      this.buffer = this.buffer.slice(-this.maxLength);
    }

    return lines;
  }

  get pending(): string {
    return this.buffer;
  }
}
