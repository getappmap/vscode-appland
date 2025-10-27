import https from 'node:https';
import { readFileSync } from 'node:fs';
import fetch, { type Response } from 'node-fetch';

export default class SplunkTelemetryReporter {
  private static readonly DEFAULT_PORT = '443';
  private agent: https.Agent | undefined;

  constructor(
    private url: string,
    private token: string,
    private commonProperties: Record<string, string>,
    ca?: string
  ) {
    const urlObj = new URL(this.url);
    if (!urlObj.port) urlObj.port = SplunkTelemetryReporter.DEFAULT_PORT;
    if (urlObj.pathname === '/') urlObj.pathname = '/services/collector/event/1.0';
    this.url = urlObj.toString();
    if (urlObj.protocol === 'https:') {
      let rejectUnauthorized = false;
      let caCert: string | Buffer | undefined;
      if (ca) {
        rejectUnauthorized = true;
        if (ca === 'system') {
          // use system ca
        } else if (ca.startsWith('@')) {
          try {
            caCert = readFileSync(ca.slice(1));
          } catch (err) {
            // fall back to system
            console.warn(`Could not read CA certificate file ${ca.slice(1)}: ${err}`);
            console.warn('Falling back to system CA certificates');
          }
        } else {
          caCert = ca;
        }
      }

      this.agent = new https.Agent({
        keepAlive: true,
        rejectUnauthorized,
        ca: caCert,
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
      name: eventName,
      properties: { ...this.commonProperties, ...properties },
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
