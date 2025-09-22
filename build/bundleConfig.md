# bundleConfig Script Documentation

## Overview

`bundleConfig.ts` is a Node.js script for updating a VSIX extension package with configuration
values from a `site-config.json` file. It injects configuration defaults, appends a date-based
version suffix, and repacks the VSIX.

## Prerequisites

- Node.js (v16+ recommended; Node 20+ can run `.ts` files directly)
- A VSIX file to modify
- A `site-config.json` file with configuration values

## Usage

With Node.js 20+ (or any version supporting direct TypeScript execution):

```
node build/bundleConfig.ts <input.vsix> <site-config.json>
```

Or, if using a compiled version:

```
node build/bundleConfig.js <input.vsix> <site-config.json>
```

Or, with ts-node:

```
ts-node build/bundleConfig.ts <input.vsix> <site-config.json>
```

- `<input.vsix>`: Path to the VSIX file to modify
- `<site-config.json>`: Path to the configuration file

## Example

Suppose you have:

- VSIX file: `my-extension.vsix`
- Config file: `site-config.json`

Run:

```
node build/bundleConfig.ts my-extension.vsix site-config.json
```

This will produce a new VSIX file named `my-extension-YYYYmmDD.vsix` (with today's date), containing
the updated configuration and version.

## What it does

- Extracts the VSIX
- Updates `extension/package.json` with values from `site-config.json`
- Adds `site-config.json` to the VSIX for reference
- Appends a date suffix to the version
- Repackages the VSIX

## Troubleshooting

- Ensure both input files exist and are readable
- Errors will be printed to the console if the process fails
