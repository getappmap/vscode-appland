# Organization Configuration

AppMap supports a remote configuration mechanism that allows IT administrators to push settings to
all users in an organization automatically. Users paste a single URL into VS Code (or receive it
silently via a managed environment variable) and AppMap applies the organization's configuration on
every startup — covering telemetry routing, binary mirror locations, and other deployment-specific
settings.

## How it works

On each startup, if a configuration URL is set, AppMap fetches a JSON file from that URL and applies
its contents as VS Code settings. The fetch happens early in the startup sequence, before any binary
downloads, so manifest URL overrides take effect immediately.

Settings are applied at the global (user) level, so they are visible in the VS Code settings UI.
Previously applied keys that are removed from the remote configuration are reverted to their
defaults on the next successful fetch. If the URL is removed by the user, previously applied
settings are retained (see [Single-shot mode](#single-shot-mode)).

Configuration is also re-fetched immediately when the URL setting changes, so a window reload is
not required after setting or updating the URL.

All activity — fetches, applied changes, errors — is logged to the **AppMap: Organization Config**
output channel (`View → Output`, then select the channel from the dropdown).

## Setting up the configuration endpoint

Host a JSON file at an HTTPS (or `file://`) URL accessible to your users. The file maps VS Code
setting keys to their values, using the same format as the `bundleConfig` site configuration:

```json
{
  "appMap.telemetry": {
    "backend": "splunk",
    "url": "https://splunk.internal.example.com:8088",
    "token": "your-hec-token",
    "ca": "system"
  },
  "appMap.manifest.appmapUrl": "https://artifacts.internal.example.com/appmap-latest.json",
  "appMap.manifest.scannerUrl": "https://artifacts.internal.example.com/scanner-latest.json",
  "appMap.autoUpdateTools": true
}
```

Only keys in the `appMap.*` namespace are applied. Any other keys in the file are silently ignored.

### Common settings

| Setting | Description |
|---|---|
| `appMap.telemetry` | Telemetry backend configuration. See [Telemetry Configuration](telemetry.md) for the full schema. |
| `appMap.manifest.appmapUrl` | URL of the AppMap CLI release manifest. Override this to point at an internal mirror. |
| `appMap.manifest.scannerUrl` | URL of the Scanner release manifest. Override this to point at an internal mirror. |
| `appMap.autoUpdateTools` | Whether to check for and download tool updates on startup. Set to `false` when distributing a VSIX with pre-bundled binaries (via `bundleConfig`) to prevent the extension from replacing them. For version pinning without bundled binaries, use a versioned manifest URL (e.g. `appmap-v3.197.1.json`) instead of the `-latest` pointer. |

For binary mirroring — hosting the AppMap and Scanner binaries on internal infrastructure and
pointing the manifest URLs at them — see [Asset Management](assets.md) and the
[Release Manifests](https://github.com/getappmap/appmap-js/blob/main/architecture/release-manifests.md)
reference.

## Distributing the configuration URL

There are three ways to deliver the URL to users, in order of how much user action is required:

### 1. Environment variable (zero user action)

Set the `APPMAP_CONFIG_URL` environment variable via group policy, MDM, or your shell environment
management tooling. AppMap reads this variable on startup and uses it as the configuration URL if
no explicit setting is configured.

This is the recommended approach for fully managed environments, since VS Code's MDM-pushable
setting subset may not include `appMap.configurationUrl`.

### 2. VS Code setting

Set `appMap.configurationUrl` in your VS Code settings deployment (e.g. via a managed
`settings.json`). This takes precedence over the environment variable if both are present.

### 3. User command (manual)

Ask users to run the **AppMap: Set organization configuration URL** command
(`Ctrl+Shift+P` / `Cmd+Shift+P`, then type `AppMap organization`). They will be prompted to enter
the URL. If `APPMAP_CONFIG_URL` is set in the environment, the prompt is pre-populated with that
value — pressing Enter without changes writes it as an explicit permanent setting.

## Behavior details

### Startup sequence

The configuration URL is fetched with a 3-second timeout near the beginning of the startup
sequence. If the fetch succeeds, settings are applied before binary downloads begin. If the fetch
times out or fails, the most recently cached configuration is used as a fallback. If no cached
configuration is available (first run, unreachable server), startup continues with existing
settings.

### Caching

The last successful fetch is cached in the extension's local storage. Subsequent startups use the
cache as a fallback if the remote URL is unreachable, ensuring that a temporarily unavailable
configuration server does not break the extension.

### Setting precedence

Remote configuration is applied at the global VS Code settings level. Workspace-scoped settings
(`.vscode/settings.json`) retain their normal higher precedence and will override remote values for
a specific project. This is intentional — remote configuration covers environment-level defaults,
while workspace settings remain under developer control.

### Single-shot mode

If you remove the configuration URL (clear `appMap.configurationUrl` and unset `APPMAP_CONFIG_URL`),
previously applied settings are **not** automatically reverted. This allows the URL to be used
as a one-time configuration bootstrap: set the URL, let settings apply, then remove the URL to
stop automatic updates while keeping the configuration in place.

To revert specific settings after removing the URL, clear them manually in the VS Code settings UI
or `settings.json`.

### Key removal

If the configuration URL remains set but a key is removed from the remote JSON file, that key is
reverted to its default value on the next successful fetch. This allows the organization to
un-apply a setting centrally.

## Troubleshooting

Open the **AppMap: Organization Config** output channel to see a log of all configuration activity,
including:

- The URL being fetched and its source (setting or environment variable)
- Each setting applied or reverted, with old and new values
- Fetch errors and whether a cached configuration was used as fallback
- A note if the URL was removed and which settings were retained

If settings are not applying as expected, verify that:

1. The URL returns valid JSON with a 2xx response code (or is a readable `file://` path)
2. All keys in the JSON are prefixed with `appMap.`
