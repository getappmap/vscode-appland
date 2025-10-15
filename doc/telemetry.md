# Telemetry Configuration

AppMap collects telemetry data to help us improve the product. By default, this data is sent to
AppMap's own telemetry service. However, you can configure AppMap to send telemetry data to your own
Splunk instance.

## Splunk Backend

To use the Splunk backend, you need to configure the following settings in your VS Code
`settings.json` file:

```json
{
  "appMap.telemetry": {
    "backend": "splunk",
    "url": "<your-splunk-hec-url>",
    "token": "<your-splunk-hec-token>",
    "ca": "<your-ca-cert>"
  }
}
```

- `appMap.telemetry.backend`: Set this to `splunk` to enable the Splunk backend.
- `appMap.telemetry.url`: The URL of your Splunk HTTP Event Collector (HEC) endpoint. Note it's
  recommended to include the port number (usually 8088 or 443).
- `appMap.telemetry.token`: Your Splunk HEC token.
- `appMap.telemetry.ca`: Your CA certificate. If not set, the server certificate will not be
  verified. If set to `system`, the system's default CA certificates will be used. If the value
  starts with `@`, it will be interpreted as a path to a CA certificate file. Otherwise, the value
  will be used as the literal CA certificate.

If the `backend` is set to `splunk` but the `url` or `token` are missing, telemetry data will not be
sent.

When the Splunk backend is enabled, the following environment variables are exposed to the AppMap
CLI:

- `APPMAP_TELEMETRY_BACKEND`: Set to `splunk`.
- `SPLUNK_URL`: The URL of your Splunk HEC endpoint.
- `SPLUNK_TOKEN`: Your Splunk HEC token.
- `SPLUNK_CA_CERT`: Your CA certificate.
