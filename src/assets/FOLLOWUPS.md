# Asset module follow-ups

Cleanups deferred from the manifest-based discovery refactor. None block shipping.

## 1. Give the Java agent a manifest

The CLI tools (`appmap`, `scanner`) are discovered and verified via signed
manifests. The Java agent still uses the legacy chain
(`MavenVersionResolver` → `GitHubReleaseResolver` → `StaticVersionResolver`,
plus `BundledFileDownloadUrlResolver` → `MavenDownloadUrlResolver` →
`GitHubDownloadUrlResolver`). The asymmetry is the main cognitive load left
in `downloaders.ts`.

Blocked on: a Java release pipeline that publishes a manifest (e.g. at
`raw.githubusercontent.com/getappmap/appmap-java/release-manifests/appmap-java-latest.json`)
with the same shape `Manifest.parse` already accepts.

Once that exists:

- Add an `appMap.manifest.javaAgentUrl` setting (default-from-package.json
  pattern, see `extensionSettings.ts`).
- Replace the `JavaAgentDownloader` chain with a manifest fetch + bundled
  fallback for offline installs.
- Drop `MavenVersionResolver`, `MavenDownloadUrlResolver`, the Maven-specific
  test mocks, and `GitHubReleaseResolver`/`GitHubDownloadUrlResolver` (no
  longer used by anyone).

## 2. Per-asset config table

`downloadCliAsset` switches on `assetId` four times and `JavaAgentDownloader`
has its own copy of the cache-check / download / symlink dance. Once the
Java agent is manifest-driven (item 1), the three downloaders can collapse
into one `downloadAsset({ name, manifestUrl, symlinkDir, ... })` over a small
config table.

## 3. `BundledFileDownloadUrlResolver.extensionDirectory` singleton

The bundled-resource directory is set via a static mutable field on the
resolver. Every asset test has to remember to set it in `beforeEach`. Thread
the path through the resolver constructor (or an init/context object) so
tests can construct what they need without touching a global.

## 4. Windows freshness check for the downgrade case

On platforms where `updateSymlink` falls back to `copyFile` (typically
Windows without Developer Mode), the file at `.appmap/bin/<tool>` is a
regular file rather than a symlink. `symlinkPointsTo` in `downloaders.ts`
treats any regular file as "leave alone" — that preserves user overrides
and avoids redundant copying on every steady-state run, but it also means
that pinning to an older manifest version *that happens to already be in
the cache* won't refresh the active binary on Windows. A content/size/mtime
comparison (or persisting the active version in a sidecar file) would close
the gap.
