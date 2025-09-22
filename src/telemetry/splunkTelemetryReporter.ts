import https from 'node:https';

import fetch, { type Response } from 'node-fetch';

export default class SplunkTelemetryReporter {
  private static readonly DEFAULT_PORT = '443';
  private agent: https.Agent | undefined;

  constructor(
    private extensionId: string,
    private extensionVersion: string,
    private url: string,
    private token: string
  ) {
    const urlObj = new URL(this.url);
    if (!urlObj.port) urlObj.port = SplunkTelemetryReporter.DEFAULT_PORT;
    if (urlObj.pathname === '/') urlObj.pathname = '/services/collector/event/1.0';
    this.url = urlObj.toString();
    if (urlObj.protocol === 'https:') {
      this.agent = new https.Agent({
        keepAlive: true,
        // Splunk instances may use self-signed certificates
        rejectUnauthorized: false,
      });
    }
  }

  private async send(data: unknown): Promise<void> {
    try {
      const result = await fetch(this.url, {
        method: 'POST',
        headers: {
          Authorization: `Splunk ${this.token}`,
        },
        body: JSON.stringify({ event: data }),
        agent: this.agent,
      });
      if (!result.ok) {
        console.warn(`Error sending telemetry to Splunk: ${result.status} ${result.statusText}`);
      }
    } catch (e) {
      // Don't let telemetry errors crash the extension
      console.warn('Error sending telemetry to Splunk', e);
    }
  }

  public testConnection(): Promise<Response> {
    return fetch(this.url, {
      method: 'POST',
      headers: {
        Authorization: `Splunk ${this.token}`,
      },
      body: '',
      agent: this.agent,
    });
  }

  sendTelemetryEvent(
    eventName: string,
    properties?: { [key: string]: string },
    measurements?: { [key: string]: number }
  ): void {
    const data = {
      extensionId: this.extensionId,
      extensionVersion: this.extensionVersion,
      eventName,
      properties,
      measurements,
    };
    this.send(data);
  }

  sendTelemetryErrorEvent(
    eventName: string,
    properties?: { [key: string]: string },
    measurements?: { [key: string]: number }
  ): void {
    this.sendTelemetryEvent(`error/${eventName}`, properties, measurements);
  }

  dispose(): Promise<void> {
    return Promise.resolve();
  }
}
