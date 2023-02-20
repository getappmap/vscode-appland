# Developing the AppMap extension for Visual Studio Code

## Quickstart

Open the project in Visual Studio Code. Make sure node modules are up to date.

```sh
$ yarn
```

Build the extension bundles.

```sh
$ yarn run compile
```

_Alternatively,_ continuously re-compile the extension any time the code changes.

```sh
$ yarn run watch
```

Launch the extension in debug mode by pressing F5.

## Packaging

To build a `vsix` file, run the `package` script.

```sh
$ yarn run package
```

## Adding AppMap CLI support for a new language

1. Make sure the language is defined in the `LANGUAGES` array in
   [`src/languageResolver.ts`](src/languageResolver.ts).
2. Add an instance of the agent to `LANGUAGE_AGENTS` in
   [`src/languageResolver.ts`](src/languageResolver.ts).
3. Verify the `readonly` property `language` of the `AppMapAgent` implementation contains the same
   value as the `id` field as the language definition in the `LANGUAGES` array in
   [`src/languageResolver.ts`](src/languageResolver.ts). This creates a link between the agent and
   the language.
4. Make sure there's a corresponding analyzer in [`src/analyzers`](src/analyzers). This implements
   the quick requirement check for the _Getting started_ page.

## Running in development with a local version of `@appland/components`

Where `$APPMAP_JS_PATH` is the path to a clone of
[`getappmap/appmap-js`](https://github.com/getappmap/appmap-js):

```sh
$ yarn link --all $APPMAP_JS_PATH
```

Note that this command will add a `resolutions` property to your `package.json` containing paths
local to your filesystem. Take care not to commit this change.

## Packaging (interim solution)

The `vscode` packaging appears to be incompatible with yarn v2. You can downgrade to yarn v1 like
so:

```sh
$ rm .yarn/releases/yarn-berry.js .yarnrc.yml
$ yarn run package
```

## Deleting uninstalled extensions from the filesystem

After uninstallation, VSCode leaves the extensions folders on the filesystem which can cause weird
problems, especially when re-installing an older version. To completely erase old extensions and
their code, delete the appland.appmap.\* folders in:

- Windows: `%USERPROFILE%\.vscode\extensions`
- Mac: `~/.vscode/extensions`
- Linux: `~/.vscode/extensions`

## Resetting saved workspace and global states

The extension uses `vscode.ExtensionContext.workspaceState` and
`vscode.ExtensionContext.globalState` for storage of the state of user's activities. To erase the
saved state, run this command in VSCode: `AppMap: Reset Usage State`

This command is implemented in `src/utils.ts` `registerUtilityCommands()`. If you are adding new
stored states, please update this function to reset the new stored states.

## Testing

This app uses a customized version of @vscode/test-electron. Integration tests are located in
`test/integration` and `test/system`. Unlike the default VSCode integration test script, each test
case is run in its own Electron process. This keeps state changes from leaking across tests.

There are some unit tests which don't run in VSCode and mock it as required. These are located in
`test/unit`. The web view part also has its own (currently rather limited) set of tests in
`web/test`.

### Running tests

You can run the whole suite or select a specific set of tests:

```
$ yarn run test
$ yarn run test:unit
$ yarn run test:web-client
$ yarn run test:system
$ yarn run test:integration
```

Note the integration tests (so, `test:system` and `test:integration`) require the extension to be
compiled first. You can do that with `yarn run compile` or by keeping `yarn run watch` running in
the background.

## Terms and conditions

By downloading and using AppMap you agree to the
[Terms and Conditions](https://appmap.io/community/terms-and-conditions).
