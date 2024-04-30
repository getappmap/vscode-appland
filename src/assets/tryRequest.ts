import * as log from './log';
import fetch, { Response, RequestInit } from 'node-fetch'; // we could use native but nock doesn't support it

export default async function tryRequest(
  url: string,
  init?: RequestInit
): Promise<Response | undefined> {
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
