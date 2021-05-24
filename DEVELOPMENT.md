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
