# [0.26.0](https://github.com/applandinc/vscode-appland/compare/v0.25.1...v0.26.0) (2022-05-24)


### Bug Fixes

* Absolute file paths don't decorate ([a068b40](https://github.com/applandinc/vscode-appland/commit/a068b40e56187db2303c7e69beac62959d2a17a4))
* Add ~/.yarn/bin to path ([009b512](https://github.com/applandinc/vscode-appland/commit/009b512f4ab179f1bbd5c2c107112a66857b0bfc))
* Add missing openapi-types ([959cc4d](https://github.com/applandinc/vscode-appland/commit/959cc4de4d2c46d154ed2e1485b32827d2657973))
* Add some Disposable subscriptions ([caeedbe](https://github.com/applandinc/vscode-appland/commit/caeedbe32680ce23181716249fc597734152dde9))
* autoIndexer|Scanner returns process Promise ([936207c](https://github.com/applandinc/vscode-appland/commit/936207c5649dc28288a2bbbdf1e2e78d379c35bc))
* Decorations show on initial editor ([54bd374](https://github.com/applandinc/vscode-appland/commit/54bd3743a05c351fcf24c0f3a654afc36e96275a))
* Fix casing in file name ([c18122e](https://github.com/applandinc/vscode-appland/commit/c18122e21d5ee8edfcc23cea01d8be34a2fd98e9))
* Fixups to rebase ([bd6a247](https://github.com/applandinc/vscode-appland/commit/bd6a247dc52f98c50663f7eb6c3343c438fe6bfa))
* Handle missing findings file ([f418c51](https://github.com/applandinc/vscode-appland/commit/f418c51f3de14ab8fc78d50039974a816ea5b420))
* Hide context menus from the command palette ([fba2a0d](https://github.com/applandinc/vscode-appland/commit/fba2a0db50286f21c1d05f4db46eaa8c924cf87d))
* Increase timeout on process service retry ([e46820a](https://github.com/applandinc/vscode-appland/commit/e46820a62789cdc835a7d94ed53a27f238ab0456))
* Path-delimited package names in the classMap ([c71ef55](https://github.com/applandinc/vscode-appland/commit/c71ef5544e048195ca4d4cec6782027c75ef5c68))
* Remove AppMap count as it's usuall wrong ([ba2b34e](https://github.com/applandinc/vscode-appland/commit/ba2b34ec128e2d4f3cd7c370cb473275bb8b12d7))
* Respond to workspace add/remove events ([564c1be](https://github.com/applandinc/vscode-appland/commit/564c1be907fadcf99b9cf50f6605291aaa662b35))
* Run service command with yarn run or npm exec ([ffee49a](https://github.com/applandinc/vscode-appland/commit/ffee49acbce1491f9738b24319c6df5c5753c5da))
* Search parent folders for npm/yarn lock files ([496b2cf](https://github.com/applandinc/vscode-appland/commit/496b2cf974634dde882f3714a06e61d45c73d707))


### Features

* Add a Code Objects tree view ([27b0d71](https://github.com/applandinc/vscode-appland/commit/27b0d716e3aaeb23e86ae7c17d71156aa4037089))
* Add AppMap 12px icon ([49ee452](https://github.com/applandinc/vscode-appland/commit/49ee452b547e773c1904d8b9e41830721872eeb8))
* Add command appmap.deleteAllAppMaps ([dd0ea7d](https://github.com/applandinc/vscode-appland/commit/dd0ea7d01f5bb68e23924c2926f8ca94faff2860))
* Context menu + click for Code Objects ([a41b05d](https://github.com/applandinc/vscode-appland/commit/a41b05d30eaaa853f30bd958348146d736732782))
* Decoration provider ([d23a0a7](https://github.com/applandinc/vscode-appland/commit/d23a0a70082cec0e37ebdb7954791c833f5b2435))
* Export extension interfaces ([70bbe69](https://github.com/applandinc/vscode-appland/commit/70bbe690ad0ba80a07f058a6c0d29ac3bdf08d97))
* Extend CodeObjectEntry fields ([2dc839e](https://github.com/applandinc/vscode-appland/commit/2dc839e71ebac9be74dc5305d9356616661d74ba))
* Feature flag for 'inspect' CLI command ([b4a7532](https://github.com/applandinc/vscode-appland/commit/b4a75328ce77afe056c3ecaa33214b2da0dfcf7f))
* Hover provider ([2b089e9](https://github.com/applandinc/vscode-appland/commit/2b089e90e924822c2a6cea1f554afc20c9fed142))
* Inspect code object via CLI shell-out ([16b45eb](https://github.com/applandinc/vscode-appland/commit/16b45ebc5b27b48bcfa61a892569270f1560cd87))
* Inspect hover shows links to ancestors ([34773c9](https://github.com/applandinc/vscode-appland/commit/34773c9c83e01f92e67e3b17a2cfdfac962c99d2))
* Line-index, hover, decoration provider ([e72de09](https://github.com/applandinc/vscode-appland/commit/e72de09f7a35aa4658523b8a6b7eb93e4e33ba5f))
* LineInfoIndex ([875c696](https://github.com/applandinc/vscode-appland/commit/875c6968925065859f56a84063e008753a4ce6e4))
* Open AppMaps from code object tree ([981bd58](https://github.com/applandinc/vscode-appland/commit/981bd58030eea677527926de628726f6e422b210))
* Open code object in AppMap ([d0c4751](https://github.com/applandinc/vscode-appland/commit/d0c4751f3da87ea2ae8f26c860ed40cc31663778))
* Simplify hover ([7bfccf1](https://github.com/applandinc/vscode-appland/commit/7bfccf13e2ce102b1a1e84254675d9cefac26104))

## [0.25.1](https://github.com/applandinc/vscode-appland/compare/v0.25.0...v0.25.1) (2022-05-24)


### Bug Fixes

* Process service now inherits user environment ([021b777](https://github.com/applandinc/vscode-appland/commit/021b777f6e86316ac87a19a84d76d2a6257579d2))

# [0.25.0](https://github.com/applandinc/vscode-appland/compare/v0.24.2...v0.25.0) (2022-05-15)


### Bug Fixes

* Fix command titles ([3a33841](https://github.com/applandinc/vscode-appland/commit/3a3384179d971a32aa50a79ca1b7778a7e21398d))
* Number.MAX_VALUE shows marker to end-of-line ([b60bef7](https://github.com/applandinc/vscode-appland/commit/b60bef775a457cf0e42c86ddf877057385dab2b8))
* Try re-adding launch args ([3b85580](https://github.com/applandinc/vscode-appland/commit/3b85580738a1102c0673fa33e9d6ed06dee41249))


### Features

* Enable/disable findings via setting ([48bee0a](https://github.com/applandinc/vscode-appland/commit/48bee0a0a4ca852be6efbf206b7fd96494499f8b))
* Identify and display Findings ([b622eaa](https://github.com/applandinc/vscode-appland/commit/b622eaab9130accbe09d005eab76d3a86040ec75))
* Index and scan AppMaps continuously ([85852f4](https://github.com/applandinc/vscode-appland/commit/85852f4b497d77b33a0a162907cfd99bde40b6c6))
* Make sure child processes are not detached ([02d1d57](https://github.com/applandinc/vscode-appland/commit/02d1d579d196e4e50c4e98bb9a01b5dc7f0b0812))
* Show error message when a dependent process can't be spawned ([a78f7d5](https://github.com/applandinc/vscode-appland/commit/a78f7d5ee0ce3fd8839d606e6246fa8e99482f72))
* Verify project Node.js version ([70b6986](https://github.com/applandinc/vscode-appland/commit/70b698637ef3e93945ba1792393a803d4230e0b2))
* Wait for child processes to terminate ([88c8792](https://github.com/applandinc/vscode-appland/commit/88c879211d3668511588799191e51fa422bc6e0d))

## [0.24.2](https://github.com/applandinc/vscode-appland/compare/v0.24.1...v0.24.2) (2022-05-13)


### Bug Fixes

* Non-root level gitignores will no longer be treated as root ([112998d](https://github.com/applandinc/vscode-appland/commit/112998d90ef51e9f8dd93b14a339d44f385dc79c))

## [0.24.1](https://github.com/applandinc/vscode-appland/compare/v0.24.0...v0.24.1) (2022-05-09)


### Bug Fixes

* Remove project watcher, milestones and quickstart ([ef2b135](https://github.com/applandinc/vscode-appland/commit/ef2b135d0023c1604d0864477cbc5977c7dda282))

# [0.24.0](https://github.com/applandinc/vscode-appland/compare/v0.23.6...v0.24.0) (2022-05-04)


### Features

* Ensure the editor is configured to watch AppMaps ([a7e3aa5](https://github.com/applandinc/vscode-appland/commit/a7e3aa5b1469f82d7eeea9d882b98c578fda58fb))

## [0.23.6](https://github.com/applandinc/vscode-appland/compare/v0.23.5...v0.23.6) (2022-05-04)


### Bug Fixes

* AppMap count responds to project add/remove ([eb50ac1](https://github.com/applandinc/vscode-appland/commit/eb50ac12b640668d849f84dafd61d98a9247a74c))
* Fix appmap.findByName ([9065f32](https://github.com/applandinc/vscode-appland/commit/9065f32413128262e2fe59bc367964d81eeb1e3d))
* Remove broken doc links ([e2f1364](https://github.com/applandinc/vscode-appland/commit/e2f136490d2aebfd2471c150d27f4a363fcc7efb))

## [0.23.5](https://github.com/applandinc/vscode-appland/compare/v0.23.4...v0.23.5) (2022-02-12)


### Bug Fixes

* Update dependencies ([cb0e9b0](https://github.com/applandinc/vscode-appland/commit/cb0e9b054024776e89c937bd4261dc4ecfe2ad8b))

## [0.23.4](https://github.com/applandinc/vscode-appland/compare/v0.23.3...v0.23.4) (2022-02-10)


### Bug Fixes

* Clarify installation instructions ([#371](https://github.com/applandinc/vscode-appland/issues/371)) ([19c15ca](https://github.com/applandinc/vscode-appland/commit/19c15ca8b0ec08ed5075db9489de08fdcc19948b))

## [0.23.3](https://github.com/applandinc/vscode-appland/compare/v0.23.2...v0.23.3) (2022-02-08)


### Bug Fixes

* Upgrade @appland/components to v1.23.0 ([5e99a48](https://github.com/applandinc/vscode-appland/commit/5e99a481f2572fb8c968d86f9f47758f0dc6f149))

## [0.23.2](https://github.com/applandinc/vscode-appland/compare/v0.23.1...v0.23.2) (2022-01-13)


### Bug Fixes

* Update README ([aa09ba4](https://github.com/applandinc/vscode-appland/commit/aa09ba41eb577c70ce264bc3346757bfc917ce4f))

## [0.23.1](https://github.com/applandinc/vscode-appland/compare/v0.23.0...v0.23.1) (2022-01-12)


### Bug Fixes

* Document availability of AppMap for JavaScript ([#370](https://github.com/applandinc/vscode-appland/issues/370)) ([591b8f0](https://github.com/applandinc/vscode-appland/commit/591b8f012a1824193e3c1dc97bf01ca88087d0cc))

# [0.23.0](https://github.com/applandinc/vscode-appland/compare/v0.22.4...v0.23.0) (2021-12-02)


### Features

* JavaScript support in the project picker ([5b7e648](https://github.com/applandinc/vscode-appland/commit/5b7e64811362032593c25d84a5068145d8cdfa80)), closes [#366](https://github.com/applandinc/vscode-appland/issues/366)

## [0.22.4](https://github.com/applandinc/vscode-appland/compare/v0.22.3...v0.22.4) (2021-11-08)


### Bug Fixes

* Don't attempt to index undefined when no languages are available ([4a6c2de](https://github.com/applandinc/vscode-appland/commit/4a6c2dea6c83262ba46c2576a2f3bd7f3eb99fae))

## [0.22.3](https://github.com/applandinc/vscode-appland/compare/v0.22.2...v0.22.3) (2021-11-05)


### Bug Fixes

* More robust language detection in project overview ([6313233](https://github.com/applandinc/vscode-appland/commit/63132334d0cb83fd3195017068e31373fadeba9a))

## [0.22.2](https://github.com/applandinc/vscode-appland/compare/v0.22.1...v0.22.2) (2021-11-02)


### Bug Fixes

* Send telemetry event on manual command copy ([4fad9d2](https://github.com/applandinc/vscode-appland/commit/4fad9d2edaaeba8c8420df725319db3c667d54fc))

## [0.22.1](https://github.com/applandinc/vscode-appland/compare/v0.22.0...v0.22.1) (2021-10-28)


### Bug Fixes

* Quote paths with spaces in "getting started" ([61612ad](https://github.com/applandinc/vscode-appland/commit/61612ad9fc9311984a487346c3ff88ef22ab4421))

# [0.22.0](https://github.com/applandinc/vscode-appland/compare/v0.21.6...v0.22.0) (2021-10-28)


### Features

* Replace quickstart screens with project picker ([73ab5ac](https://github.com/applandinc/vscode-appland/commit/73ab5ac4615a8ddd2a206fa074ae7475ad06eb3c))

## [0.21.6](https://github.com/applandinc/vscode-appland/compare/v0.21.5...v0.21.6) (2021-10-25)


### Bug Fixes

* Update extension description in README ([#359](https://github.com/applandinc/vscode-appland/issues/359)) ([00a2270](https://github.com/applandinc/vscode-appland/commit/00a22703262bbf02336aef8042461d9fa303ce28))

## [0.21.5](https://github.com/applandinc/vscode-appland/compare/v0.21.4...v0.21.5) (2021-10-21)


### Bug Fixes

* Add the project path to the installer command ([#356](https://github.com/applandinc/vscode-appland/issues/356)) ([69de4b9](https://github.com/applandinc/vscode-appland/commit/69de4b9ba96e7c562897dd4a97d4afa8c9dfba34))

## [0.21.4](https://github.com/applandinc/vscode-appland/compare/v0.21.3...v0.21.4) (2021-10-08)


### Bug Fixes

* Ignore file access errors where possible ([8b7ac90](https://github.com/applandinc/vscode-appland/commit/8b7ac9020a01a89bb1c12ff8f1017bd1aaed6a67))

## [0.21.3](https://github.com/applandinc/vscode-appland/compare/v0.21.2...v0.21.3) (2021-10-05)


### Bug Fixes

* Update social media section in README ([#355](https://github.com/applandinc/vscode-appland/issues/355)) ([74049c0](https://github.com/applandinc/vscode-appland/commit/74049c00752f9dcc65bc0dd101964dada41132bd))

## [0.21.2](https://github.com/applandinc/vscode-appland/compare/v0.21.1...v0.21.2) (2021-10-04)


### Bug Fixes

* Update Marketplace description ([a22ca47](https://github.com/applandinc/vscode-appland/commit/a22ca47ff077a22f2a6303411f2a587d9b41f263))

## [0.21.1](https://github.com/applandinc/vscode-appland/compare/v0.21.0...v0.21.1) (2021-09-24)


### Bug Fixes

* Capture debug information on number of workspace folders ([ede0c1c](https://github.com/applandinc/vscode-appland/commit/ede0c1caf48a2aca1830672a0ecaf966114043f1))

# [0.21.0](https://github.com/applandinc/vscode-appland/compare/v0.20.0...v0.21.0) (2021-09-22)


### Features

* Load AppMaps from a URI ([#232](https://github.com/applandinc/vscode-appland/issues/232)) ([2d38e4e](https://github.com/applandinc/vscode-appland/commit/2d38e4e30c3686836ae24e540e92cb3f7ad5cb8c))

# [0.20.0](https://github.com/applandinc/vscode-appland/compare/v0.19.0...v0.20.0) (2021-09-21)


### Bug Fixes

* Disable uploading AppMaps from within the app ([3fb2d4e](https://github.com/applandinc/vscode-appland/commit/3fb2d4ef0389c420814ed5fcf4fa5e1fcae33268))
* Upgrade @appland/components to v1.12.2 ([e8d6bba](https://github.com/applandinc/vscode-appland/commit/e8d6bbaa470d3d0f1d27222abf03709cc18fa564))


### Features

* Welcome and install views have merged ([1644d43](https://github.com/applandinc/vscode-appland/commit/1644d43dabe9cfdffce351e70b7779e224e69b5e))

# [0.19.0](https://github.com/applandinc/vscode-appland/compare/v0.18.1...v0.19.0) (2021-09-17)


### Features

* Show progress notification when remote recording is in progress ([#350](https://github.com/applandinc/vscode-appland/issues/350)) ([9854030](https://github.com/applandinc/vscode-appland/commit/98540303ed0642f8b87323623af2393b80833e8d))

## [0.18.1](https://github.com/applandinc/vscode-appland/compare/v0.18.0...v0.18.1) (2021-09-15)


### Bug Fixes

* Update README ([f3e1ee0](https://github.com/applandinc/vscode-appland/commit/f3e1ee07a02cb6f9f8ded7ed2d28b8a7576cb32a))

# [0.18.0](https://github.com/applandinc/vscode-appland/compare/v0.17.2...v0.18.0) (2021-09-07)


### Bug Fixes

* Better support for `.gitignore` while identifying project language ([#334](https://github.com/applandinc/vscode-appland/issues/334)) ([92d175d](https://github.com/applandinc/vscode-appland/commit/92d175d32b814edaaff7908c3a4a6a3bb57d1053))


### Features

* Add additional telemetry events ([#328](https://github.com/applandinc/vscode-appland/issues/328)) ([21a8839](https://github.com/applandinc/vscode-appland/commit/21a883952de42a86f9ac943c53e8c510d7584ab8))
* Add CLI installer flow ([#325](https://github.com/applandinc/vscode-appland/issues/325)) ([882767f](https://github.com/applandinc/vscode-appland/commit/882767f696299a936d3e332813bfa30961282844))
* Add context menu to AppMap panel ([#344](https://github.com/applandinc/vscode-appland/issues/344)) ([14492c5](https://github.com/applandinc/vscode-appland/commit/14492c5080ade2a67042e814ceafebc847bc2727))

## [0.17.2](https://github.com/applandinc/vscode-appland/compare/v0.17.1...v0.17.2) (2021-08-11)


### Bug Fixes

* Do not show instructions popup automatically ([f62a93a](https://github.com/applandinc/vscode-appland/commit/f62a93a5a04cef7bf6ff4ef8e35bba2286b8f7c7))

## [0.17.1](https://github.com/applandinc/vscode-appland/compare/v0.17.0...v0.17.1) (2021-08-10)


### Bug Fixes

* Don't coerce arbitrary types into strings ([53800dc](https://github.com/applandinc/vscode-appland/commit/53800dc30dd6e62700c735d5967b201f7002aa79))

# [0.17.0](https://github.com/applandinc/vscode-appland/compare/v0.16.0...v0.17.0) (2021-08-06)


### Bug Fixes

* Don't open a webview upon initialization ([a44ce5b](https://github.com/applandinc/vscode-appland/commit/a44ce5b81a48a5ff0a0ee547d60b1ed6169ad842))


### Features

* Add the ability to upload AppMaps to AppLand cloud ([#182](https://github.com/applandinc/vscode-appland/issues/182)) ([5b5b35f](https://github.com/applandinc/vscode-appland/commit/5b5b35fd8d1809b6df1f80023142198a655741bc))

# [0.16.0](https://github.com/applandinc/vscode-appland/compare/v0.15.2...v0.16.0) (2021-08-05)


### Features

* Replace `Insatll AppMap agent` button ([7de440a](https://github.com/applandinc/vscode-appland/commit/7de440a19c4fad296aee3a6ed825107ac5f0226b))

## [0.15.2](https://github.com/applandinc/vscode-appland/compare/v0.15.1...v0.15.2) (2021-08-03)


### Bug Fixes

* Alter files included in the extension bundle ([2b765d5](https://github.com/applandinc/vscode-appland/commit/2b765d53e5663770ac78b7225962f34f70804bd0))

## [0.15.1](https://github.com/applandinc/vscode-appland/compare/v0.15.0...v0.15.1) (2021-08-01)


### Bug Fixes

* Abort project polling if one of the ticks fails unexpectedly. ([daeb191](https://github.com/applandinc/vscode-appland/commit/daeb19198929b75ae8fcc2df20e8c90a8ffcad4e))

# [0.15.0](https://github.com/applandinc/vscode-appland/compare/v0.14.4...v0.15.0) (2021-07-30)


### Bug Fixes

* add possible folders with appmaps to file watcher ([a003af6](https://github.com/applandinc/vscode-appland/commit/a003af6e1e8dec196faf1f90ea56bbcbca694df5))
* check recording status when trying to stop not running session ([7163177](https://github.com/applandinc/vscode-appland/commit/7163177041affa2bffb4f9bfb2763dbdd3900f87))
* ensure config contents is available on step 2 for fresh installations ([0743a4a](https://github.com/applandinc/vscode-appland/commit/0743a4a9d2b5fc8ef67c1537ff2d13a2695a056e))
* finish extension initialization when no workspace is open ([e4bd612](https://github.com/applandinc/vscode-appland/commit/e4bd612f1f445ca12a1d80a52c3b7757ee5c084f))
* Only return supported languages when identifying project language ([875856c](https://github.com/applandinc/vscode-appland/commit/875856cee17c9649b465b6c54eb17733a1f85429))
* prevent silent errors when CLI commands are failed ([fb37b8f](https://github.com/applandinc/vscode-appland/commit/fb37b8f5aabe2a938b9c087ba091a33b01aebd25))
* read project.testFrameworks after the `status` information is available ([213cffe](https://github.com/applandinc/vscode-appland/commit/213cffe6831371ddeed6655661494dca1d99fb58))
* real links to docs ([17c2fd3](https://github.com/applandinc/vscode-appland/commit/17c2fd36628bfdf7c8849019ae078a3b04f3e15b))
* set steps 3 and 4 incomplete when steps 1 or 2 are completed ([efec142](https://github.com/applandinc/vscode-appland/commit/efec142e531358dea1e3982ebf5f40622732211c))
* show update notification only when extension was updated ([b8217c4](https://github.com/applandinc/vscode-appland/commit/b8217c4c45b808dc070e961be80c839db008b8ed))


### Features

* add 'Using AppMaps' and 'Mastering AppMaps' sidebar lists ([#253](https://github.com/applandinc/vscode-appland/issues/253)) ([30097fa](https://github.com/applandinc/vscode-appland/commit/30097faf2ba2d106b0278a68c64b8ef5a55cec7f))
* Add Quickstart documentation pages ([#297](https://github.com/applandinc/vscode-appland/issues/297)) ([444dadb](https://github.com/applandinc/vscode-appland/commit/444dadbb8d4d7d65fa324cfb8389da88aa1cf57b))
* Reset saved usage state ([9885b57](https://github.com/applandinc/vscode-appland/commit/9885b5739ae863d1d66fe7f5223063ebb8529634))
* show 'Open Quickstart' button when no appmaps found ([3620dcb](https://github.com/applandinc/vscode-appland/commit/3620dcb17e820662062ea0574ec33e3c7cbc28d1))

## [0.14.4](https://github.com/applandinc/vscode-appland/compare/v0.14.3...v0.14.4) (2021-06-23)


### Bug Fixes

* Upgrade dependencies ([ff05077](https://github.com/applandinc/vscode-appland/commit/ff050778940b5c9bc0b8b959df1230de992e3bf8))
* Upgrade dependencies ([83b21a1](https://github.com/applandinc/vscode-appland/commit/83b21a134f0f2cf3a12b1116b8e88701460935fc))

## [0.14.3](https://github.com/applandinc/vscode-appland/compare/v0.14.2...v0.14.3) (2021-06-16)


### Bug Fixes

* Bundle diagram styling ([e525c2e](https://github.com/applandinc/vscode-appland/commit/e525c2e967c37be6359c2cecdadd192187be7494))

## [0.14.2](https://github.com/applandinc/vscode-appland/compare/v0.14.1...v0.14.2) (2021-06-15)


### Bug Fixes

* Upgrade @appland/components to v1.1.8 ([ec39e09](https://github.com/applandinc/vscode-appland/commit/ec39e099eed1392d75f6e5fef9c95ca9c6aa5615))

## [0.14.1](https://github.com/applandinc/vscode-appland/compare/v0.14.0...v0.14.1) (2021-06-09)


### Bug Fixes

* Upgrade @appland/components to v1.1.6, @appland/models to v1.0.6 ([aab9672](https://github.com/applandinc/vscode-appland/commit/aab96729418cc5bfc6757d66cd7c1ad75d717a9d))

# [0.14.0](https://github.com/applandinc/vscode-appland/compare/v0.13.0...v0.14.0) (2021-06-07)


### Bug Fixes

* Don't rely on isNewAppInstall for new installations ([#202](https://github.com/applandinc/vscode-appland/issues/202)) ([c29aaca](https://github.com/applandinc/vscode-appland/commit/c29aaca4db67cf00d07f38de67d5be011997713f))
* Send event counts as metrics instead of event properties ([#200](https://github.com/applandinc/vscode-appland/issues/200)) ([d521b3a](https://github.com/applandinc/vscode-appland/commit/d521b3a66f3c1e83fa0ee8c6e193039cb06ff533))


### Features

* Add remote recording commands and interface ([#183](https://github.com/applandinc/vscode-appland/issues/183)) ([c5615a7](https://github.com/applandinc/vscode-appland/commit/c5615a7d071ce6548fa3a4b892417824961162bc))

# [0.13.0](https://github.com/applandinc/vscode-appland/compare/v0.12.1...v0.13.0) (2021-05-20)


### Bug Fixes

* Initialize after startup has completed ([5abe7d4](https://github.com/applandinc/vscode-appland/commit/5abe7d4611efd2e8f45e12ac09f25aa21b900370))


### Features

* Report AppMap agent references and project language/framework on initialize ([a11feca](https://github.com/applandinc/vscode-appland/commit/a11feca72db940ca750a3cee5a9ca9078109b463))
* Send telemetry event after extension installation ([8024b63](https://github.com/applandinc/vscode-appland/commit/8024b633749463543ed0bb23fecd4308b77c99a8))
* Send telemetry event upon opening a URL from the AppMap view ([505c87a](https://github.com/applandinc/vscode-appland/commit/505c87a7ae86ee0d2cd5905f267236c6d56cfdfd))

## [0.12.1](https://github.com/applandinc/vscode-appland/compare/v0.12.0...v0.12.1) (2021-04-30)


### Bug Fixes

* The AppMap panel will no longer display AppMaps within node_modules ([e4a5a06](https://github.com/applandinc/vscode-appland/commit/e4a5a0659f6cdc3a01ba7f60be75b559e0749ef4))

# [0.12.0](https://github.com/applandinc/vscode-appland/compare/v0.11.1...v0.12.0) (2021-04-28)


### Features

* Add AppMap to the sidebar ([a650bb7](https://github.com/applandinc/vscode-appland/commit/a650bb7071df0c8b8d5d867d922a514cedfc3322))
* Display patch notes in the AppMap viewer ([323ade6](https://github.com/applandinc/vscode-appland/commit/323ade664781a15e75b77c75465e3645c6153c85))
* filter and search AppMaps ([91a8f5e](https://github.com/applandinc/vscode-appland/commit/91a8f5e593018c0c8944f8dd49758d0d42e30357))
* update @appland/appmap to v2.3.4 ([c8f9ace](https://github.com/applandinc/vscode-appland/commit/c8f9ace4288046aafdf80065a04182bbf114fabe))

## [0.11.1](https://github.com/applandinc/vscode-appland/compare/v0.11.0...v0.11.1) (2021-04-22)


### Bug Fixes

* Remove command state subscriptions when initializing new views ([cb1ef33](https://github.com/applandinc/vscode-appland/commit/cb1ef334b9126d2f73b9f0b9a0162395ee194827))

# [0.11.0](https://github.com/applandinc/vscode-appland/compare/v0.10.1...v0.11.0) (2021-04-22)


### Features

* Add commands to read and write AppMap state ([21fd561](https://github.com/applandinc/vscode-appland/commit/21fd561ba50fc262c9fd1cc5658ef61a7010fbb5))
* Upgrade @appland/appmap to v2.2.0 ([b7a7e09](https://github.com/applandinc/vscode-appland/commit/b7a7e09cc378e52ccc7d58b07ff91fb599eeca81))

## [0.10.1](https://github.com/applandinc/vscode-appland/compare/v0.10.0...v0.10.1) (2021-04-07)


### Bug Fixes

* Update instrumentation key ([147a94a](https://github.com/applandinc/vscode-appland/commit/147a94ae9c8d1b56bb76878f256f71bae628d4ee))

# [0.10.0](https://github.com/applandinc/vscode-appland/compare/v0.9.1...v0.10.0) (2021-04-06)


### Bug Fixes

* AppMap instructions are now shown upon first opening the extension ([#164](https://github.com/applandinc/vscode-appland/issues/164)) ([4de99a6](https://github.com/applandinc/vscode-appland/commit/4de99a6793f2b2ae525866d0c63328de8898e85b))
* Upgrade @appland/appmap to v1.12 ([54cd392](https://github.com/applandinc/vscode-appland/commit/54cd392f37bbc67a85551e55a4d534c43a78bed1))


### Features

* Report anonymous usage metadata and webview exceptions ([#167](https://github.com/applandinc/vscode-appland/issues/167)) ([b519176](https://github.com/applandinc/vscode-appland/commit/b519176ecd4c0f34bc7a9806b17d5149d746c191))

## [0.9.1](https://github.com/applandinc/vscode-appland/compare/v0.9.0...v0.9.1) (2021-03-24)


### Bug Fixes

* revert bundled logo ([d9a9e69](https://github.com/applandinc/vscode-appland/commit/d9a9e69f33515377fba947a7acdcc9e187d001e0))

# [0.9.0](https://github.com/applandinc/vscode-appland/compare/v0.8.6...v0.9.0) (2021-03-24)


### Features

* update @appland/appmap to v1.7.0 ([16635b4](https://github.com/applandinc/vscode-appland/commit/16635b442bb2810e3d072b5a4a09df48725ed2a9))

## [0.8.6](https://github.com/applandinc/vscode-appland/compare/v0.8.5...v0.8.6) (2021-03-23)


### Bug Fixes

* doc and video update for recent agent changes ([eaef258](https://github.com/applandinc/vscode-appland/commit/eaef2581ecc1c34c1a9e38409818824acd046efa))

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
