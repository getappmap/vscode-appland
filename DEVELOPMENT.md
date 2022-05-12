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
[`applandinc/appmap-js`](https://github.com/applandinc/appmap-js):

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

This app uses the built-in VSCode mechanism for integration tests: it downloads and runs the
integration test suite within a dedicated VSCode instance. Integration tests are located in
`test/integration`.

### Running tests

Here's what's working for me:

```
yarn run pretest && yarn run test:extension
```

Test case code is JavaScript in the `out/test` directory, so the test cases need to be compiled from
`test/integration` to `out/test/integration`. The `pretest` command seems to do this - it works for
me anyway. Running the TypeScript compiler in a watch mode doesn't seem to work - I don't know why
not.

### Test side effects and state leakage

Note that all the tests use the same VSCode process, so test cases must be sure and establish the
state they want and be good citizens about cleaning up afterwards. This is not ideal, and unstable
test cases due to state leaking across test cases is probably inevitable. But, it's also not really
avoidable without making the test suite hella slow.

There are utiliity functions to clean/reset the workspace - invoke them before and/or after each
test.

## Running a specified test

You may be used to using the `-t` option to run a specific test. This will not work with VSCode
extension tests, because the test runner is actually running inside the dedicated VSCode instance,
no command line options are propagated through to it.

To run a specific test, use the `TEST_PATH` option, which can be a file name or glob pattern. It's
resolved relative to the `test/integration` directory. Here's an example:

```
yarn run pretest && TEST_PATH='appmapTextEditor.test.js' yarn run test:extension
```
