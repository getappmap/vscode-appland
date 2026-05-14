# Implementation Plan: Organization Configuration URL

Feature design and discussion are complete. This document captures resolved decisions and the
implementation steps for the next session. Delete after implementation is merged.

## Design decisions (settled — do not relitigate)

- **Setting**: `appMap.configurationUrl` (visible in settings UI)
- **Env var**: `APPMAP_CONFIG_URL` as zero-touch fallback
- **Precedence**: explicit setting (non-empty) → env var → inactive
- **Empty string == undefined**: both fall through to env var; no special sentinel for opt-out
- **Schema**: `appMap.*` keys only, same flat format as `bundleConfig` `site-config.json`; other
  keys silently ignored; response must be a JSON object or it is rejected; `appMap.configurationUrl`
  itself is explicitly excluded (prevents accidental self-referential loops)
- **Protocols**: `https://`, `http://`, and `file://` (the last for testing/local use)
- **Fetch timing**: kicked off at the very top of `activate()`, awaited before
  `AssetService.ensureAssets()` but not before `Telemetry.register()` (brief stale-telemetry window
  is acceptable; manifest URLs must be fresh before any download)
- **Timeout**: 3 seconds; on timeout/failure fall back to last cached config in `globalState`
- **Apply**: `workspace.getConfiguration('appMap').update(subKey, value, ConfigurationTarget.Global)`
  — writes to user `settings.json`, visible in settings UI, immediately reflected in subsequent reads
- **Caching**: store `{ url, config }` in `context.globalState` after every successful fetch;
  applied keys are derived from `Object.keys(config).filter(k => k.startsWith('appMap.'))` — no
  separate `appliedKeys` field needed
- **Key diffing**: on each fetch, old applied keys come from the cached config; new applied keys
  come from the freshly fetched config; keys present in old but absent in new are reverted
- **Cache fallback**: only used when the cached URL matches the current URL; if the URL changed and
  the new URL is unreachable, log an error and do nothing (old cache is for a different URL)
- **URL removal**: when no URL is active, do NOT revert applied settings (single-shot use case);
  log a note listing retained keys derived from the cached config if one exists
- **Last URL**: stored as part of the cached `{ url, config }` object; used to detect URL
  change/removal for logging and to validate cache applicability
- **Output channel name**: `"AppMap: Organization Config"`
- **Logging**: fetch start (with source: setting vs env var), each changed/reverted key (with
  before/after values), errors, cache-fallback notices, URL-removed notice with retained key list

## Files to create

### `src/configuration/remoteConfig.ts`

The core service. Responsibilities:
- `getConfigUrl()`: read `appMap.configurationUrl` setting; fall back to `process.env.APPMAP_CONFIG_URL`
- `apply(context, outputChannel)`: public entry point; serialises calls via a stored promise chain
  so concurrent invocations (startup + config-change watcher) never interleave; comment should
  explain this is the reason for the chaining pattern
- `doApply(context, outputChannel)`: the actual implementation; orchestrate fetch → cache → diff → write → log cycle
  - reads `globalState` for cached `{ url, config }`
  - handles no-URL case (log retained keys derived from cached config if present)
  - races fetch against timeout, falls back to cache on failure (same URL only)
  - filters to `appMap.*` keys excluding `appMap.configurationUrl` itself, calls
    `getConfiguration('appMap').update()` for each
  - reverts keys present in old cached config but absent from new fetch
  - persists updated `{ url, config }` cache to `globalState`

VS Code API calls (`vscode.workspace.getConfiguration`, `context.globalState`) are used directly —
the test mock infrastructure (mockery via `test/unit/mock/vscode/index.ts`) stubs these
automatically without explicit injection.

### `src/commands/setConfigurationUrl.ts`

Single command handler. Responsibilities:
- Read current explicit setting and env var
- Call `window.showInputBox` pre-populated with current setting, or env var if no setting, or empty
- On confirm with non-empty value: `update('configurationUrl', value, ConfigurationTarget.Global)`
- On confirm with empty value: `update('configurationUrl', undefined, ConfigurationTarget.Global)`
- On cancel (returns `undefined`): no-op
- Show information message prompting reload after a non-empty URL is set

### `test/unit/remoteConfig.test.ts`

Written before the implementation (red first). See test cases below.

### `doc/organization-config.md`

Already written in the planning session.

## Files to modify

### `src/assets/tryRequest.ts`

Extend to support `file://` URLs by detecting the scheme and reading from disk via
`fs.promises.readFile` rather than node-fetch. This gives `RemoteConfig` a single fetch utility
and also allows manifest URLs to be `file://` paths for testing/air-gapped scenarios.

Change the return type from node-fetch's `Response` to a narrow explicit interface covering only
what callers actually use (`.json()` in `manifest.ts`, `.text()` in `resolvers.ts`):

```typescript
export interface FetchResult {
  ok: boolean;
  json(): Promise<unknown>;
  text(): Promise<string>;
}
```

The HTTP path: node-fetch's `Response` already satisfies this interface, so it's a clean narrowing
with no cast needed. The `file://` path returns a plain object implementing the same interface.
Callers don't name the return type explicitly so no changes needed at call sites.

### `package.json`

Add to `contributes.configuration.properties`:

```json
"appMap.configurationUrl": {
  "type": "string",
  "markdownDescription": "URL of the organization configuration file. AppMap fetches this on startup and applies any `appMap.*` settings it contains. Can also be set via the `APPMAP_CONFIG_URL` environment variable (explicit setting takes precedence)."
}
```

Note: VS Code setting descriptions cannot reliably link to in-repo markdown files.

Add to `contributes.commands`:

```json
{
  "command": "appmap.setConfigurationUrl",
  "title": "AppMap: Set organization configuration URL"
}
```

### `src/extension.ts`

Near the top of `activate()`, after the output channel is created but before `Telemetry.register()`:

```typescript
const orgConfigChannel = vscode.window.createOutputChannel('AppMap: Organization Config');
context.subscriptions.push(orgConfigChannel);
const remoteConfigPromise = RemoteConfig.apply(context, orgConfigChannel);
```

Then, immediately before the `AssetService.ensureAssets()` call (currently around line 244):

```typescript
await remoteConfigPromise;
```

Register the command (alongside other command registrations):

```typescript
context.subscriptions.push(
  vscode.commands.registerCommand('appmap.setConfigurationUrl', () =>
    setConfigurationUrl()
  )
);
```

Register the config watcher normally — concurrency is handled by the lock inside `apply()`:

```typescript
context.subscriptions.push(
  vscode.workspace.onDidChangeConfiguration((e) => {
    if (e.affectsConfiguration('appMap.configurationUrl')) {
      void RemoteConfig.apply(context, orgConfigChannel);
    }
  })
);
```

### `test/unit/mock/vscode/window.ts`

Expand `createOutputChannel` to return a mock with a `lines: string[]` buffer rather than
`appendLine: doNothing`, so tests can assert on log output by inspecting the buffer directly.

Since tests consume VS Code types (not the mock type), `lines` won't be visible on
`vscode.OutputChannel`. Export a typed helper alongside the mock — for example a
`getOutputChannelLines` function or a `MockOutputChannel` interface — so tests can cast cleanly
without losing type safety. The implementation session should settle the exact shape, but the goal
is no raw `as any` casts in tests.

`append` (no newline) should append to the last entry in the buffer, or push a new entry if the
buffer is empty, to keep the buffer consistent with what `appendLine` produces. Do not leave it as
`doNothing` — silent discard would make the buffer contents misleading if `append` is accidentally
used instead of `appendLine`.

```typescript
createOutputChannel: () => {
  const lines: string[] = [];
  return {
    lines,
    append: (value: string) => {
      if (lines.length === 0) lines.push(value);
      else lines[lines.length - 1] += value;
    },
    appendLine: (line: string) => { lines.push(line); },
    clear: () => { lines.length = 0; },
    hide: doNothing,
    name: '',
    show: doNothing,
    dispose: doNothing,
  };
},
```

## Implementation order

Follow red/green TDD as far as possible:

1. **`package.json`**: add setting and command contributions (no logic, safe to do first)
2. **Expand output channel mock** in `test/unit/mock/vscode/window.ts`; add typed helper for test access to buffer
3. **Extend `src/assets/tryRequest.ts`** to support `file://` URLs
4. **Write `test/unit/remoteConfig.test.ts`** — all test cases, expect failures (red)
5. **Implement `src/configuration/remoteConfig.ts`** until tests pass (green)
6. **Write command tests** in `test/unit/remoteConfig.test.ts` or a separate file
7. **Implement `src/commands/setConfigurationUrl.ts`** until command tests pass (green)
8. **Wire into `src/extension.ts`** — output channel, `remoteConfigPromise`, await, command registration, config watcher
9. **Run `yarn test:unit`** — all new and existing tests should pass
10. **Manual smoke test**: set a `file://` config URL, change it without reloading, verify immediate re-fetch and apply; verify revert on key removal; verify retained-on-URL-removal behaviour

## Test cases

### `remoteConfig` service

**`getConfigUrl()`**
- returns the setting value when `appMap.configurationUrl` is set to a non-empty string
- returns the env var when the setting is absent
- returns the env var when the setting is an empty string
- returns `undefined` when both are absent

**`tryRequest()` (extended, in existing or new test file)**
- reads and returns content from a `file://` URL via `.json()` and `.text()`
- returns `undefined` for a non-existent `file://` path (consistent with existing HTTP error behaviour)

**fetch/apply timeout**
- rejects after the timeout elapses; use `sinon.useFakeTimers()` to advance the clock rather than
  a real delay — set up a nock interceptor that never resolves (or delays), tick the fake clock
  past the timeout, verify the promise rejected

**`apply()` — no active URL**
- does nothing and logs nothing when there are no previously applied keys
- logs a message listing retained keys when `appliedKeys` is non-empty in `globalState`
- does not write to VS Code config
- does not modify `globalState`

**`apply()` — successful fetch**
- applies each `appMap.*` key from the fetched config to VS Code global settings
- skips keys not prefixed with `appMap.`
- skips `appMap.configurationUrl` even if present in the fetched config
- logs each applied key with its new value
- does not log keys whose value is unchanged
- stores `{ url, config }` in `globalState`
- logs the active URL and its source (setting vs env var)

**`apply()` — fetch failure with cached config**
- logs a fetch error
- falls back to the cached config and applies it
- logs that a cached configuration is being used

**`apply()` — fetch failure without cache**
- logs the error
- does not modify VS Code settings
- does not modify `globalState`

**`apply()` — key removal (second call with changed config)**
- reverts keys present in the previously cached config but absent from the new fetch (sets to `undefined`)
- logs each reverted key
- updates cached `{ url, config }` in `globalState` to reflect the new state

**`apply()` — URL changed, new URL unreachable**
- does not fall back to cache when the cached URL differs from the current URL
- logs an error and leaves settings unchanged

### Command

- shows an empty input box when no setting and no env var are present
- pre-populates the input box with the env var value when no explicit setting exists
- pre-populates the input box with the current setting value when one is set
- writes the entered URL to `appMap.configurationUrl` at `ConfigurationTarget.Global` on confirm
- removes the setting (sets to `undefined`) when an empty string is submitted
- does nothing when the input box is cancelled

## Key files for reference

- `src/extension.ts:81` — `Telemetry.register(context)` (telemetry fires before await)
- `src/extension.ts:244` — asset download decision (await remote config before this)
- `src/assets/tryRequest.ts` — reuse for `http(s)://` fetching (node-fetch, nock-compatible)
- `src/configuration/extensionSettings.ts` — pattern for reading `appMap.*` settings
- `test/mocks/mockExtensionContext.ts` — provides in-memory `globalState` for unit tests
- `test/unit/mock/vscode/workspace.ts` — `Configuration` mock (get/update work against in-memory map)
- `test/unit/mock/vscode/window.ts` — expand `createOutputChannel` here
