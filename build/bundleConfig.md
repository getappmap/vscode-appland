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
./build/bundleConfig.ps1 -VsixPath <path/to/your.vsix> -SiteConfigPath <path/to/your/site-config.json> [-PlatformIdentifier <platform>] [-Binaries <path/to/binary1>,<path/to/binary2>]
```

- `<path/to/your.vsix>`: Path to the VSIX file to modify.
- `<path/to/your/site-config.json>`: Path to the configuration file.
- `-PlatformIdentifier`: (Optional) The platform identifier for which to download tools (e.g.,
  `win-x64`, `linux-x64`, `macos-arm64`). If provided, the script will download the `appmap` and
  `scanner` tools from GitHub.
- `-Binaries`: (Optional) A comma-separated list of paths to binary files to include in the VSIX
  under `/extension/resources`.

## Example

Suppose you have:

- VSIX file: `my-extension.vsix`
- Config file: `site-config.json`

To download the tools for Windows x64 and bundle them into the VSIX, run:

```powershell
./build/bundleConfig.ps1 -VsixPath my-extension.vsix -SiteConfigPath site-config.json -PlatformIdentifier win-x64
```

This will download the latest versions of the `appmap` and `scanner` tools for Windows x64 to the
current directory, and then bundle them into a new VSIX file named `my-extension-mod.vsix`.

## What it does

- If a `-PlatformIdentifier` is provided, it downloads the `appmap` and `scanner` tools from GitHub
  for the specified platform.
- Extracts the VSIX to a temporary directory.
- Updates `extension/package.json` with values from `site-config.json`.
- Adds `site-config.json` to the VSIX for reference.
- Adds any provided or downloaded binaries to `/extension/resources` in the VSIX.
- Repackages the VSIX into a new file with a `-mod.vsix` suffix.

## Troubleshooting

- Ensure both input files exist and are readable
- Errors will be printed to the console if the process fails
