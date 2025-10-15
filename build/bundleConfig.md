# bundleConfig Script Documentation

## Overview

`bundleConfig.ps1` is a PowerShell script for updating a package (e.g., VSIX or IntelliJ plugin) with configuration
values from a `site-config.json` file. It injects configuration defaults and repacks the package.

## Prerequisites

- PowerShell
- A package file to modify (e.g., `.vsix` or `.zip`)
- A `site-config.json` file with configuration values

## site-config.json example

```json
{
    "appMap.telemetry": {
        "backend": "splunk",
        "url": "https://localhost:8088",
        "token": "abcd1234"
    },
    "appMap.autoUpdateTools": false
}
```

## Usage

```powershell
./build/bundleConfig.ps1 -PackagePath <path/to/your.package> -SiteConfigPath <path/to/your/site-config.json> [-PlatformIdentifier <platform>] [-Binaries <path/to/binary1>,<path/to/binary2>]
```

- `<path/to/your.package>`: Path to the package file to modify.
- `<path/to/your/site-config.json>`: Path to the configuration file.
- `-PlatformIdentifier`: (Optional) The platform identifier for which to download tools (e.g.,
  `win-x64`, `linux-x64`, `macos-arm64`). If provided, the script will download the `appmap` and
  `scanner` tools from GitHub.
- `-Binaries`: (Optional) A comma-separated list of paths to binary files to include in the package
  under `<toplevel>/resources`.

## Example

Suppose you have:

- Package file: `my-extension.vsix`
- Config file: `site-config.json`

To download the tools for Windows x64 and bundle them into the package, run:

```powershell
./build/bundleConfig.ps1 -PackagePath my-extension.vsix -SiteConfigPath site-config.json -PlatformIdentifier win-x64
```

This will download the latest versions of the `appmap` and `scanner` tools for Windows x64 to the
current directory, and then bundle them into a new package file named `my-extension-mod.vsix`.

## What it does

- If a `-PlatformIdentifier` is provided, it downloads the `appmap` and `scanner` tools from GitHub
  for the specified platform.
- Extracts the package to a temporary directory.
- If `package.json` is found, updates it with values from `site-config.json`.
- Adds `site-config.json` to the package for reference.
- Adds any provided or downloaded binaries to `<toplevel>/resources` in the package.
- Repackages the archive into a new file with a `-mod` suffix.
  - **Note:** The repacked archive is written to the current working directory, not necessarily alongside the input package file.

## Known limitations

The script requires that the package archive contains exactly one top-level directory. This is true for the currently released AppMap packages, but if there are multiple top-level directories, the script may fail or behave unexpectedly.

## Troubleshooting

- Ensure both input files exist and are readable
- Errors will be printed to the console if the process fails
