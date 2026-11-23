import vscode from 'vscode';

// this is in a separate file to avoid circular dependencies

export const OutputChannel = vscode.window.createOutputChannel('AppMap: Assets', 'log');

// Kept to go with a report of a failed install. The warnings leading up to it say why a
// download failed (an HTTP status, a DNS or TLS error), where the error it ends in rarely
// does: a manifest that couldn't be fetched is just that by the time it's thrown. Few
// enough lines to stay under the 8 KB limit on a telemetry property.
const RECENT_LINES = 30;
const recent: string[] = [];

function log(message: string, level: 'INFO' | 'ERROR' | 'WARN' = 'INFO') {
  const line = `${new Date().toLocaleString()} ${level.padEnd(5, ' ')} ${message}`;
  OutputChannel.appendLine(line);
  recent.push(line);
  if (recent.length > RECENT_LINES) recent.shift();
}

// For telemetry. A mirror's URLs can carry credentials, in the user info or as a signed
// query, while all that says anything about a failure is which host and path it was. The
// output channel keeps them whole.
function redactUrls(line: string): string {
  // Punctuation that ends the URL belongs to the sentence around it, as in "from <url>: ...".
  return line.replace(/\b[a-z][a-z0-9+.-]*:\/\/[^\s'"<>]*[^\s'"<>.,;:)\]]/gi, (match) => {
    try {
      const url = new URL(match);
      return `${url.protocol}//${url.host}${url.pathname}`;
    } catch {
      return '[URL]';
    }
  });
}

export function recentLines(): string {
  return recent.map(redactUrls).join('\n');
}

export function info(message: string) {
  log(message, 'INFO');
}

export function error(message: string) {
  log(message, 'ERROR');
}

export function warning(message: string) {
  log(message, 'WARN');
}
