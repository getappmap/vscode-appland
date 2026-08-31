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
| `appMap.customerId` | Identifies the organization this installation belongs to, and puts the extension into its signed-in state without requiring users to authenticate against getappmap.com. See [Customer ID](#customer-id). |

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
(`Ctrl+Shift+P` / `Cmd+Shift+P`, then type `AppMap organization`). A quick-pick menu offers four
options:

- **Set URL** — prompts for a URL. If `APPMAP_CONFIG_URL` is set in the environment, the prompt is
  pre-populated with that value — pressing Enter without changes writes it as an explicit permanent
  setting.
- **Local File** — opens a file browser to select a local JSON configuration file and applies it
  immediately as a one-shot operation. See [One-shot local file application](#one-shot-local-file-application).
- **Clear** — reverts every setting the organization configuration applied, discards the cached
  configuration, and removes the URL setting. If the URL came from `APPMAP_CONFIG_URL`, a warning
  explains that AppMap cannot unset the variable and the configuration will be applied again on the
  next activation.
- **Status** — reports whether this installation is entitled by a
  [customer ID](#customer-id) and where that came from, along with the active configuration URL and
  its source. This is usually the fastest way to answer "which configuration is this editor
  actually using?".

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

### One-shot local file application

The **Local File** option in the **Set organization configuration URL** command applies a local JSON
file directly, without setting a URL. The file is read and applied once; AppMap does not watch it
for changes.

Applied settings persist in VS Code global settings until changed manually — there is no automatic
revert path, and subsequent extension restarts do not re-apply or revert them.

If a configuration URL is active when you apply a local file, AppMap first reverts all settings
that were applied by that URL and clears the URL setting before applying the local file. If the URL
came from the `APPMAP_CONFIG_URL` environment variable (which AppMap cannot clear), a warning is
shown: the local file's settings will take effect immediately, but will be overwritten by the remote
configuration on the next extension activation as long as the environment variable remains set.

### Key removal

If the configuration URL remains set but a key is removed from the remote JSON file, that key is
reverted to its default value on the next successful fetch. This allows the organization to
un-apply a setting centrally.

## Customer ID

Normally every user must sign in to getappmap.com through GitHub, GitLab, or email before the
extension leaves its "sign in" state. Where licensing is already settled by an agreement with
AppMap, that step adds nothing: it fails outright under network restrictions, and it puts an
authentication flow through security review that grants no more than the contract already does.

Setting `appMap.customerId` removes it. The extension behaves as though the user were signed in:
the sign-in view and the "Activate AppMap" walkthrough step disappear, and runtime analysis is
enabled. The value is also passed to the AppMap CLI subprocesses as `APPMAP_CUSTOMER_ID`, and sent
with telemetry events as `common.customerid` so that usage can be attributed to your organization
(see [Telemetry Configuration](telemetry.md)).

```json
{
  "appMap.customerId": "acme-corp"
}
```

Use whatever identifier your AppMap agreement specifies. Any non-empty string is accepted; blank
and whitespace-only values are treated as absent.

### What it is not

- **Not a secret.** It is not a license key or a token, it grants no access to anything, and it
  does not need to be protected. It is stored in the extension's local storage in plain text, and
  on a bundled build it is visible in the VS Code settings UI.
- **Not an enforcement mechanism.** The extension is open source, so the check is a business
  process, not a security boundary. It records which organization an installation belongs to; it
  does not prevent anything.
- **Not a substitute for authentication where authentication is wanted.** Signing in still works
  and still takes precedence: if a user has a real session, its API key is what authenticates
  requests, and the customer ID is used only for attribution. The AppMap sign-in entry stays
  available in the Accounts menu.

Because attribution rides on telemetry, it only reaches you if telemetry is enabled and a backend
is reachable. Treat it as best-effort reporting rather than seat counting.

### Setting it

The customer ID can be delivered through any of the organization-configuration channels:

1. **Configuration URL** — include `appMap.customerId` in the JSON your configuration URL serves.
   This is the usual choice, and the only one that can be changed centrally afterwards. As with
   any other key, the last successful fetch is cached, so entitlement survives a temporarily
   unreachable configuration server — which matters most in exactly the restricted networks this
   feature exists for.
2. **Local file** — include it in a JSON file applied through the **Local File** quick-pick option.
   Applied once, and retained afterwards.
3. **Bundled VSIX** — include it in the `site-config.json` you repackage the extension with. See
   [bundleConfig](../build/bundleConfig.md). The extension then carries its own customer ID with no
   configuration server involved, which suits fully air-gapped deployments.

A configuration URL or local file takes precedence over a bundled value, so a repackaged VSIX can
be re-pointed centrally without rebuilding it. If the bundled value changes in a later VSIX, the
new one takes effect unless a configuration URL has set one.

Setting `appMap.customerId` by hand in `settings.json` has **no effect** — only a value delivered
through one of the channels above is honored. On a bundled build, where the setting is visible in
the settings UI, AppMap warns once per session if it finds a hand-written override and offers to
remove it.

### Retention and removal

Like every other organization-configuration key, the customer ID follows
[single-shot mode](#single-shot-mode): removing the configuration URL does **not** revert it. This
is deliberate, so that a URL can be used as a one-time bootstrap, but it does mean that an
installation stays entitled after the URL is gone.

To remove it, either:

- remove `appMap.customerId` from the JSON your configuration URL serves, while the URL is still
  set — it is reverted on the next successful fetch, like any other key; or
- run **AppMap: Set organization configuration URL** and choose **Clear**, which reverts every
  setting the organization configuration applied, the customer ID included.

On a bundled build, clearing reverts to the customer ID built into the VSIX rather than to nothing —
that value is part of the installation. To run a bundled build unentitled, install a standard build
from the Marketplace.

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
