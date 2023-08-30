import bent, { NodeResponse } from 'bent';

export default class RemoteRecordingClient {
  private static readonly RECORDING_URI = '/_appmap/record';

  static async start(baseURL: string): Promise<number> {
    const getStream = bent(baseURL, 'POST', 200, 409);
    const stream = (await getStream(this.RECORDING_URI)) as {
      statusCode: number;
    };

    return stream.statusCode;
  }

  static async getStatus(baseURL: string): Promise<boolean> {
    const request = bent(baseURL, 'GET', 200);
    const response = (await request(this.RECORDING_URI)) as NodeResponse;
    const body = (await response.json()) as { enabled: boolean };

    return body.enabled;
  }

  static async stop(baseURL: string): Promise<unknown> {
    const getStream = bent(baseURL, 'DELETE', 200, 404);
    const stream = (await getStream(this.RECORDING_URI)) as {
      statusCode: number;
      json;
    };

    return {
      statusCode: stream.statusCode,
      body: await stream.json(),
    };
  }
}
