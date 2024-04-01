import AssetService from './assetService';
import fetch, { Response, RequestInit } from 'node-fetch';

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
      AssetService.logWarning(`Failed to request ${url}: got status ${res.status}`);
      return;
    }

    return res;
  } catch (e) {
    AssetService.logWarning(`Failed to request ${url}: ${e}`);
    return;
  }
}
