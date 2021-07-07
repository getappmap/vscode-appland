# Developing the AppMap extension for Visual Studio Code

## Quickstart

Open the project in Visual Studio Code. Make sure node modules are up to date.

```sh
$ npm i
```

Build the extension bundles.

```sh
$ npm run compile
```

_Alternatively,_ continuously re-compile the extension any time the code changes.

```sh
$ npm run watch
```

Launch the extension in debug mode by pressing F5.

## Packaging

To build a `vsix` file, run the `package` script.

```sh
$ npm run package
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

1. From the `applandinc/appmap-js` directory, `cd` into `packages/components`
2. Run `yarn link $VSCODE_APPLAND_PATH` where `$VSCODE_APPLAND_PATH` is the path to this project's
   directory
3. You may need to install `highlight.js`: `yarn add highlight.js`
4. `yarn run compile` or `yarn run watch` to compile scripts
5. Press `F5` from Visual Studio Code to run the development extension
