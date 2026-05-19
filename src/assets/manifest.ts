import { createHash } from 'node:crypto';
import { createReadStream } from 'node:fs';

import * as log from './log';
import tryRequest from '../lib/tryRequest';
import { getPlatformIdentifier } from './types';

export interface ManifestAsset {
  readonly url: string;
  readonly digest?: string;
}

// Captures the platform identifier suffix of a manifest asset name, e.g.
// `scanner-linux-x64`, `scanner-macos-arm64`, `scanner-win-x64.exe`. Anchored
// so an unrelated trailing token (e.g. `scanner-linux-x64-debug`) won't be
// silently bucketed alongside the canonical asset. The capture group excludes
// any `.exe` suffix so Windows and non-Windows entries share a key shape.
const PLATFORM_IN_ASSET_NAME = /((?:linux|macos|win)-(?:x64|arm64))(?:\.exe)?$/;

export class Manifest {
  private constructor(
    readonly version: string,
    private readonly assetsByPlatform: ReadonlyMap<string, ManifestAsset>
  ) {}

  // Parses and validates a manifest from raw JSON.
  // Returns undefined (and logs a warning) when the manifest is structurally invalid.
  static parse(raw: unknown): Manifest | undefined {
    if (!raw || typeof raw !== 'object') {
      log.warning('Manifest is not a JSON object');
      return undefined;
    }
    const obj = raw as Record<string, unknown>;

    const tagName = obj.tag_name;
    if (typeof tagName !== 'string') {
      log.warning('Manifest tag_name is missing or not a string');
      return undefined;
    }

    const match = /v(\d+\.\d+\.\d+[\w.+-]*)$/.exec(tagName);
    if (!match) {
      log.warning(`Could not parse manifest version from tag ${tagName}`);
      return undefined;
    }
    const version = match[1];

    const rawAssets = obj.assets;
    if (!Array.isArray(rawAssets)) {
      log.warning('Manifest assets is missing or not an array');
      return undefined;
    }

    const assetsByPlatform = new Map<string, ManifestAsset>();
    for (const entry of rawAssets) {
      if (!entry || typeof entry !== 'object') continue;
      const asset = entry as Record<string, unknown>;
      const { name, url, digest } = asset;
      if (typeof name !== 'string' || typeof url !== 'string') continue;
      const platformMatch = PLATFORM_IN_ASSET_NAME.exec(name);
      if (!platformMatch) continue;
      assetsByPlatform.set(platformMatch[1], {
        url,
        digest: typeof digest === 'string' ? digest : undefined,
      });
    }

    return new Manifest(version, assetsByPlatform);
  }

  // Returns the asset (url and optional digest) for the given platform identifier.
  // Defaults to the current process's platform.
  getAsset(platform: string = getPlatformIdentifier()): ManifestAsset | undefined {
    return this.assetsByPlatform.get(platform);
  }
}

// Verifies that the file at `path` matches `expectedDigest`, which is the
// `algo:hex` digest format used in manifest assets (currently only `sha256`).
export async function verifyDigest(path: string, expectedDigest: string): Promise<boolean> {
  const [algo, hash] = expectedDigest.split(':');
  if (algo !== 'sha256') {
    log.warning(`Unsupported digest algorithm: ${algo}`);
    return false;
  }

  return new Promise((resolve) => {
    const stream = createReadStream(path);
    const sha256 = createHash('sha256');
    stream.on('data', (data) => sha256.update(data));
    stream.on('end', () => {
      const actualHash = sha256.digest('hex');
      resolve(actualHash === hash);
    });
    stream.on('error', (err) => {
      log.warning(`Failed to compute digest for ${path}: ${err}`);
      resolve(false);
    });
  });
}

export class ManifestManager {
  private static cache = new Map<string, Promise<Manifest | undefined>>();

  static async fetch(url: string): Promise<Manifest | undefined> {
    const cached = this.cache.get(url);
    if (cached) return cached;

    const promise = (async () => {
      const res = await tryRequest(url);
      if (!res) return undefined;
      try {
        const raw: unknown = await res.json();
        const manifest = Manifest.parse(raw);
        if (manifest) log.info(`Fetched manifest from ${url} (version ${manifest.version})`);
        return manifest;
      } catch (e) {
        log.warning(`Failed to fetch manifest from ${url}: ${e}`);
        return undefined;
      }
    })();

    this.cache.set(url, promise);
    // Don't pin failures: a transient outage or parse error would otherwise
    // disable manifest discovery until the extension is restarted.
    void promise.then((m) => {
      if (!m && this.cache.get(url) === promise) this.cache.delete(url);
    });
    return promise;
  }

  static clearCache(): void {
    this.cache.clear();
  }
}
