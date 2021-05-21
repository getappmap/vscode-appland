import * as bent from 'bent';

export default class RemoteRecording {
  private static readonly RECORDING_URI = '/_appmap/record';

  static async start(baseURL: string): Promise<void> {
    const request = bent(baseURL, 'POST', 'string', 200);
    await request(this.RECORDING_URI);
  }

  static async getStatus(baseURL: string): Promise<boolean> {
    const request = bent(baseURL, 'GET', 'json', 200);

    const response = (await request(this.RECORDING_URI)) as {
      enabled: boolean;
    };
    return response.enabled;
  }

  static async stop(baseURL: string): Promise<JSON> {
    const request = bent(baseURL, 'DELETE', 'json', 200);

    return (await request(this.RECORDING_URI)) as JSON;
  }
}
