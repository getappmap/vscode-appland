import { basename } from 'node:path';

export enum AssetIdentifier {
  AppMapCli,
  ScannerCli,
  JavaAgent,
}

// eslint-disable-next-line @typescript-eslint/naming-convention
export const binaryName = (name: string) => (process.platform === 'win32' ? `${name}.exe` : name);

export function getPlatformIdentifier() {
  switch (process.platform) {
    case 'win32':
      return `win-${process.arch}`;
    case 'darwin':
      return `macos-${process.arch}`;
    default:
      return `linux-${process.arch}`;
  }
}

export function versionFromPath(p: string): string | undefined {
  const base = basename(p)
    .replace(/\.exe$/, '')
    .replace(/\.jar$/, '');
  const match = base.match(/-(\d.*)$/);
  if (!match) return undefined;
  return match[1];
}
