# Asset Management System

The asset management system handles the download, caching, and usage of required binaries for the
extension, such as AppMap CLI, Scanner CLI, and the Java agent. It is designed to work seamlessly
with both automatically downloaded assets and pre-bundled binaries.

## How It Works

- **Automatic Download:** On startup or when required, the system checks for the presence of
  required binaries. If missing, it downloads the latest versions from official sources (NPM, Maven,
  GitHub).
- **Caching:** Downloaded binaries are stored in a platform-appropriate cache directory (e.g.,
  `~/.cache/appmap` on Linux).
- **Symlinks:** The system maintains symlinks in `~/.appmap/bin` and `~/.appmap/lib/java` pointing
  to the actual binaries.
- **Bundled Binaries:** If binaries are present in the `resources` directory of the extension
  package, these are used in preference to downloading.

## Bundled Binaries in `/resources`

The asset system supports using pre-existing binaries placed in the `resources` directory at the
package root. This is especially useful for distributing a VSIX package with custom or pre-approved
binaries.

### Naming Conventions

- AppMap CLI: `appmap-<platform>-<arch>-<version>` (e.g., `appmap-linux-x64-0.9.0`)
- Scanner CLI: `scanner-<platform>-<arch>-<version>` (e.g. `scanner-win-x64-1.8.0.exe`)
- Java Agent: `appmap-<version>.jar` (e.g. `appmap-1.44.jar`)

### How Bundled Binaries Are Used

- On startup, the extension checks for required binaries in the `resources` directory.
- If a matching binary is found, it is symlinked from `resources` into `~/.appmap`.
- If not found, the system falls back to downloading the binary.

## Modifying a Published VSIX to Bundle Custom Binaries

You can prepare a modified VSIX package with custom binaries by adding or replacing files in the
`extension/resources` directory (note the package root is in `extension` subdirectory of the zip
file).

### Steps

1. **Extract the VSIX:**  
   A VSIX file is a zip archive. Extract it using any zip tool.

2. **Add or Replace Binaries:**  
   Place your binaries in the `extension/resources` directory at the root of the extracted archive,
   following the naming conventions above.

3. **Repack the VSIX:**  
   Zip the contents back up, ensuring the directory structure is preserved and the
   `extension/resources` directory is at the root.

4. **Install the Modified VSIX:**  
   Install the VSIX in Visual Studio Code as usual. The extension will detect and use the bundled
   binaries from the `extension/resources` directory.

### Notes

- If a required binary is not found in the cache or `resources`, it will be downloaded automatically
  (unless updates are disabled).
- This approach is useful for distributing extensions with custom, pre-approved, or air-gapped
  binaries.

---

For more details on the asset system implementation, see the source files in `src/assets/`.
