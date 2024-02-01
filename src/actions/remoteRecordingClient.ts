import http, { type IncomingMessage } from 'node:http';
import https from 'node:https';

export default class RemoteRecordingClient {
  static async start(baseURL: string): Promise<number> {
    return (await recordRequest(baseURL, 'POST', [200, 409])).statusCode;
  }

  static async getStatus(baseURL: string): Promise<boolean> {
    const response = await recordRequest(baseURL, 'GET', [200]);
    const body = await readJSON(response);
    if (typeof body === 'object' && body && 'enabled' in body && typeof body.enabled === 'boolean')
      return body.enabled;
    else throw new Error(`Unexpected body: ${body}`);
  }

  static async stop(baseURL: string): Promise<{ statusCode: number; body: unknown }> {
    const response = await recordRequest(baseURL, 'DELETE', [200, 404]);
    return {
      statusCode: response.statusCode,
      body: await readJSON(response).catch(() => undefined),
    };
  }
}

function recordRequest(
  baseURL: string,
  method: string,
  codes: number[]
): Promise<IncomingMessage & { statusCode: number }> {
  if (!baseURL.startsWith('http')) baseURL = `http://${baseURL}`;
  const url = new URL('_appmap/record', baseURL);
  const proto = url.protocol === 'https:' ? https : http;
  return new Promise((resolve, reject) =>
    proto
      .request(url, { method }, (response) =>
        response.statusCode && codes.includes(response.statusCode)
          ? resolve(response as IncomingMessage & { statusCode: number })
          : reject(new Error(`unexpected response code: ${response.statusCode}`))
      )
      .once('error', reject)
      .end()
  );
}

async function readJSON(res: NodeJS.ReadableStream): Promise<unknown> {
  const chunks: string[] = [];
  for await (const chunk of res) chunks.push(chunk.toString());
  return JSON.parse(chunks.join(''));
}
