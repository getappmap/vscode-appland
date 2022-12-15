import { Writable } from 'stream';

export default class MemoryStream extends Writable {
  private buffer = Buffer.alloc(1024);
  private offset = 0;
  public _write(
    chunk: Buffer | string | unknown,
    encoding: BufferEncoding,
    callback: (error?: Error | null) => void
  ): void {
    let chunkBuffer: Buffer | undefined;

    if (typeof chunk === 'string') chunkBuffer = Buffer.from(chunk, encoding);
    else if (Buffer.isBuffer(chunk)) chunkBuffer = chunk;

    if (!chunkBuffer) {
      callback(new Error('chunk must be a string or a buffer'));
      return;
    }

    // Make sure the chunk will fit within the bounds of the currently allocated buffer.
    // If not, allocate a new buffer to the next power of 2 that will fit the chunk.
    if (this.offset + chunkBuffer.length > this.buffer.length) {
      let nextSize = this.buffer.length * 2;
      while (nextSize - this.offset < chunkBuffer.length) nextSize *= 2;
      this.buffer = Buffer.concat([this.buffer, Buffer.alloc(nextSize)]);
    }

    // I'm not re-encoding here, just copying the buffer. If you're writing chunks
    // of mixed encodings, beware.
    this.buffer.copy(chunkBuffer, this.offset);
    this.offset += chunkBuffer.length;

    callback();
  }
}
