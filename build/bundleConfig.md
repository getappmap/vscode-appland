# bundleConfig Script Documentation

## Overview

`bundleConfig.ps1` is a PowerShell script for updating a VSIX extension package with configuration
values from a `site-config.json` file. It injects configuration defaults and repacks the VSIX.

## Prerequisites

- PowerShell
- A VSIX file to modify
- A `site-config.json` file with configuration values

## Usage

```powershell
./build/bundleConfig.ps1 -VsixPath <path/to/your.vsix> -SiteConfigPath <path/to/your/site-config.json>
```

- `<path/to/your.vsix>`: Path to the VSIX file to modify
- `<path/to/your/site-config.json>`: Path to the configuration file

## Example

Suppose you have:

- VSIX file: `my-extension.vsix`
- Config file: `site-config.json`, for example:

```json
{
  "appMap.telemetry": {
    "backend": "splunk",
    "url": "https://splunk.example.com:443",
    "token": "333-abc-xyz"
  },
  "appMap.autoUpdateTools": false
}
```

Run:

```powershell
./build/bundleConfig.ps1 -VsixPath my-extension.vsix -SiteConfigPath site-config.json
```

This will produce a new VSIX file named `my-extension-mod.vsix`, containing the updated
configuration.

## What it does

- Extracts the VSIX to a temporary directory
- Updates `extension/package.json` with values from `site-config.json`
- Adds `site-config.json` to the VSIX for reference
- Repackages the VSIX into a new file with a `-mod.vsix` suffix

## Troubleshooting

- Ensure both input files exist and are readable
- Errors will be printed to the console if the process fails
