import proxiedFetch from '../lib/proxiedFetch';

export default async function tryRequest(
  url: string,
  init?: RequestInit
): Promise<Response | undefined> {
  try {
    const res = await proxiedFetch(url, {
      redirect: 'follow',
      ...(init || {}),
    });

    // Just fail if it's non-2xx
    // We're following redirects automatically, so we shouldn't be getting 3xx
    if (!res.ok) {
      return;
    }

    return res;
  } catch (e) {
    return;
  }
}
