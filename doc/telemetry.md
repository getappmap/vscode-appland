# Telemetry Configuration

AppMap collects telemetry data to help us improve the product. By default, this data is sent to
AppMap's own telemetry service. However, you can configure AppMap to send telemetry data to your own
Splunk instance.

## Splunk Backend

To use the Splunk backend, you need to configure the following settings in your VS Code
`settings.json` file:

```json
{
  "appmap.telemetry": {
    "backend": "splunk",
    "url": "<your-splunk-hec-url>",
    "token": "<your-splunk-hec-token>"
  }
}
```

- `appmap.telemetry.backend`: Set this to `splunk` to enable the Splunk backend.
- `appmap.telemetry.url`: The URL of your Splunk HTTP Event Collector (HEC) endpoint. Note it's
  recommended to include the port number (usually 8088 or 443).
- `appmap.telemetry.token`: Your Splunk HEC token.

If the `backend` is set to `splunk` but the `url` or `token` are missing, telemetry data will not be
sent.

When the Splunk backend is enabled, the following environment variables are exposed to the AppMap
CLI:

- `APPMAP_TELEMETRY_BACKEND`: Set to `splunk`.
- `SPLUNK_URL`: The URL of your Splunk HEC endpoint.
- `SPLUNK_TOKEN`: Your Splunk HEC token.
