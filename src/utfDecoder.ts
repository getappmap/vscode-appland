/**
 * Decode UTF-encoded text; the encoding is assumed to be UTF-8 unless a BOM is
 * present and indicates a different one. BOM if present is stripped from the result.
 *
 * This function implements decode algorithm from https://encoding.spec.whatwg.org/#legacy-hooks
 * @param buffer — encoded text
 * @returns decoded text
 */
export default function utfDecoder(buffer: Uint8Array): string {
  const bomEncoding = (() => {
    if (buffer[0] === 0xfe && buffer[1] === 0xff) return 'utf-16be';
    if (buffer[0] === 0xff && buffer[1] === 0xfe) return 'utf-16le';
    return undefined;
  })();

  return new TextDecoder(bomEncoding).decode(buffer);
}
