import * as log from '../assets/log';
import * as fs from 'fs';
import { fileURLToPath } from 'url';
import fetch, { RequestInit } from 'node-fetch'; // we could use native but nock doesn't support it

export interface FetchResult {
  ok: boolean;
  json(): Promise<unknown>;
  text(): Promise<string>;
}

export default async function tryRequest(
  url: string,
  init?: RequestInit
): Promise<FetchResult | undefined> {
  if (url.startsWith('file://')) {
    const filePath = fileURLToPath(url);
    try {
      const content = await fs.promises.readFile(filePath, 'utf8');
      return {
        ok: true,
        json: async () => JSON.parse(content),
        text: async () => content,
      };
    } catch (e) {
      log.warning(`Failed to read ${url}: ${e}`);
      return undefined;
    }
  }

  try {
    const res = await fetch(url, {
      redirect: 'follow',
      ...(init || {}),
    });

    // Just fail if it's non-2xx
    // We're following redirects automatically, so we shouldn't be getting 3xx
    if (!res.ok) {
      log.warning(`Failed to request ${url}: got status ${res.status}`);
      return;
    }

    return res;
  } catch (e) {
    log.warning(`Failed to request ${url}: ${e}`);
    return;
  }
}
