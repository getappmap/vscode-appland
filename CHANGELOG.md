## [0.8.5](https://github.com/applandinc/vscode-appland/compare/v0.8.4...v0.8.5) (2021-03-18)


### Bug Fixes

* adding java video and tutorial to docs ([b6684ed](https://github.com/applandinc/vscode-appland/commit/b6684edaf5de541be5fba2ceda5bf8ba523c4b67))

## [0.8.4](https://github.com/applandinc/vscode-appland/compare/v0.8.3...v0.8.4) (2021-03-11)


### Bug Fixes

* adding support@ email to documentation ([b888dcd](https://github.com/applandinc/vscode-appland/commit/b888dcdd6c8a688b588154a4eb0fa9d1c7b60a8b))

## [0.8.3](https://github.com/applandinc/vscode-appland/compare/v0.8.2...v0.8.3) (2021-03-11)


### Bug Fixes

* sharing instructions, setup videos ([8273f34](https://github.com/applandinc/vscode-appland/commit/8273f343388f50f77b5c53c926fff68b0de0e3ef))

## [0.8.2](https://github.com/applandinc/vscode-appland/compare/v0.8.1...v0.8.2) (2021-03-06)


### Bug Fixes

* updated description and keywords ([3e0a1f3](https://github.com/applandinc/vscode-appland/commit/3e0a1f305d0ba6390be0740e5d672d98c7dea6e2))

## [0.8.1](https://github.com/applandinc/vscode-appland/compare/v0.8.0...v0.8.1) (2021-03-05)


### Bug Fixes

* update docs for positioning, arrow keys in trace ([#146](https://github.com/applandinc/vscode-appland/issues/146)) ([cb7e690](https://github.com/applandinc/vscode-appland/commit/cb7e690a030d7f0340c07258b4cc4c9ccba01374))

# [0.8.0](https://github.com/applandinc/vscode-appland/compare/v0.7.0...v0.8.0) (2021-03-05)


### Features

* update @appland/appmap to v1.4.0 ([c7d9a7f](https://github.com/applandinc/vscode-appland/commit/c7d9a7fc294729f4b852e1020ecbe633f50c874f))

# [0.7.0](https://github.com/applandinc/vscode-appland/compare/v0.6.1...v0.7.0) (2021-02-25)


### Features

* update @appland/appmap to v1.2.0 ([#143](https://github.com/applandinc/vscode-appland/issues/143)) ([a1600cf](https://github.com/applandinc/vscode-appland/commit/a1600cf95c498b4e111028dbac351460330e4ff6))

## [0.6.1](https://github.com/applandinc/vscode-appland/compare/v0.6.0...v0.6.1) (2021-02-25)


### Bug Fixes

* documentation improvements ([ea791fa](https://github.com/applandinc/vscode-appland/commit/ea791fa849e8e62fa564b3b51b031b1dca4ae34f))

# [0.6.0](https://github.com/applandinc/vscode-appland/compare/v0.5.1...v0.6.0) (2021-02-23)


### Features

* update @appland/appmap to v1.1.2 ([3b7ca61](https://github.com/applandinc/vscode-appland/commit/3b7ca615c64f17b5008bbfaf699561ae8a501eb6))

## [0.5.1](https://github.com/applandinc/vscode-appland/compare/v0.5.0...v0.5.1) (2021-02-19)


### Bug Fixes

* add additional videos to the README ([#133](https://github.com/applandinc/vscode-appland/issues/133)) ([a2445dd](https://github.com/applandinc/vscode-appland/commit/a2445dd22a92ab0b295931c69016ce728fb4a08e))

# [0.5.0](https://github.com/applandinc/vscode-appland/compare/v0.4.1...v0.5.0) (2021-02-19)


### Features

* update [@appland](https://github.com/appland).appmap to v1.1.1 ([c7add9c](https://github.com/applandinc/vscode-appland/commit/c7add9cf4c970689685695d022519fe2c08582df))

## [0.4.1](https://github.com/applandinc/vscode-appland/compare/v0.4.0...v0.4.1) (2021-02-18)


### Bug Fixes

* reverting package-lock.js to master version ([dc2ea81](https://github.com/applandinc/vscode-appland/commit/dc2ea819c4cb8ec756b5c5f673ef6cade4812275))

# [0.4.0](https://github.com/applandinc/vscode-appland/compare/v0.3.2...v0.4.0) (2021-02-12)


### Features

* update @appland/appmap to v1.0.1 ([f0ac6f3](https://github.com/applandinc/vscode-appland/commit/f0ac6f3b4646fb29c0cddcde59713881d5365f5a))

## 0.3.2

- "View source" from the context menu should now work in all cases
- Routes in the dependency map will now favor the normalized path if available
- Components which have no associated runtime execution data will not be displayed
- HTTP events in the trace view will now be named correctly when viewing an appmap generated from Java
- Packages will continue to be highlighted after expand, collapse or switching views
- Packages are now represented by their leafs instead of their top level identifier
- Links from a class to a query now go to the expected destination
- Details for query events no longer use the raw SQL as the title

## 0.3.1
- Upgrade `@appland/appmap` to `v0.2.2`
- Rename 'component diagram' to 'dependency map'
- Rename 'flow view' to 'trace'
- 'Reset view' can be selected from the context menu from anywhere in the
  viewport
- Packages are now visible when expanded
- Fix an issue where long vertical columns could cause the diagrams to center
  out of the visible space.
- HTTP server responses are now visible in the event details panel

## 0.2.1
- Update documentation

## 0.2.0
- Allow 'view source code' from events, functions and classes
- Improved compatability with VS Code theme
- Reduced file size of extension

## 0.1.0
- Initial release
