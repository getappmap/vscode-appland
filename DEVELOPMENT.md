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
4. Define a version constraint in [`package.json`](package.json) under the `appmapDependencies`
   property. The agent will not be installed without it.

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
their code, delete the appland.appmap.* folders in:

- Windows: `%USERPROFILE%\.vscode\extensions`
- Mac: `~/.vscode/extensions`
- Linux: `~/.vscode/extensions`

## Resetting saved workspace and global states

The extension uses `vscode.ExtensionContext.workspaceState` and `vscode.ExtensionContext.globalState`
for storage of the state of user's activities. To erase the saved state, run this command in VSCode:
`AppMap: Reset Usage State`

This command is implemented in `src/utils.ts` `registerUtilityCommands()`. If you are adding new
stored states, please update this function to reset the new stored states. 
