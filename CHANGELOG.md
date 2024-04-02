# [0.117.0](https://github.com/getappmap/vscode-appland/compare/v0.116.0...v0.117.0) (2024-04-02)


### Bug Fixes

* Retrieving saved filters always returns an array ([214f9fd](https://github.com/getappmap/vscode-appland/commit/214f9fd7bea00ec64e43af6eec4ff4641240f60d))
* RPC service will restart when the authentication session changes ([74af543](https://github.com/getappmap/vscode-appland/commit/74af5439163e833d40acec52e560bdd104cfef80))


### Features

* Allow configuring CLI environment ([2e203fa](https://github.com/getappmap/vscode-appland/commit/2e203fa8546ec8f308cadbd74651e7283e374f58))
* Configure Navie port manually for dev + debugging ([d7b22c6](https://github.com/getappmap/vscode-appland/commit/d7b22c61d356ae18333e7bf8540398bce16b7627))
* Implement a more resilient asset download strategy ([2a0108b](https://github.com/getappmap/vscode-appland/commit/2a0108b1eb2a15b832ba8b223fc9538f59605150))

# [0.116.0](https://github.com/getappmap/vscode-appland/compare/v0.115.0...v0.116.0) (2024-03-22)


### Features

* Open Navie from an appmap ([#920](https://github.com/getappmap/vscode-appland/issues/920)) ([f6eda7f](https://github.com/getappmap/vscode-appland/commit/f6eda7f3aa7622001061ea643b084ee23ebd7fde))

# [0.115.0](https://github.com/getappmap/vscode-appland/compare/v0.114.0...v0.115.0) (2024-03-21)


### Features

* A progress notification will appear if Navie is not yet ready ([a3bf806](https://github.com/getappmap/vscode-appland/commit/a3bf8065f87dc081a1748ea24540ae0bc3fa014d))
* Periodically poll for missed appmap.yml FS events ([ca46be1](https://github.com/getappmap/vscode-appland/commit/ca46be10113e39f27f8cd42ada2e998edac4d156))
* Run a single RPC server per instance ([fb0357f](https://github.com/getappmap/vscode-appland/commit/fb0357fc0a8410a132c59410b3987584e550543c))

# [0.114.0](https://github.com/getappmap/vscode-appland/compare/v0.113.1...v0.114.0) (2024-03-16)


### Features

* Add Navie explain code action provider to jsx and tsx ([c1790c2](https://github.com/getappmap/vscode-appland/commit/c1790c2bc2a9b771cd4090af9f687ca346b41687))
* Revised and reactive Navie status bar ([b2ce7b2](https://github.com/getappmap/vscode-appland/commit/b2ce7b29e80c0dd8bc89adb64cf93c1715d6cc8d))

## [0.113.1](https://github.com/getappmap/vscode-appland/compare/v0.113.0...v0.113.1) (2024-03-14)


### Bug Fixes

* Apply appropriate flags to CLI installer ([bacc41b](https://github.com/getappmap/vscode-appland/commit/bacc41b234defae9676c89ab35b9efa0142f533c))

# [0.113.0](https://github.com/getappmap/vscode-appland/compare/v0.112.0...v0.113.0) (2024-03-09)


### Features

* Enable "bring your own OpenAI key" ([300689e](https://github.com/getappmap/vscode-appland/commit/300689e97fd7af78a51e1dff48f193f30e3470c6))
* Obfuscate secrets in the spawn log env ([0b2bdab](https://github.com/getappmap/vscode-appland/commit/0b2bdab10feabd25a2acf59ac19763868b8006fb))

# [0.112.0](https://github.com/getappmap/vscode-appland/compare/v0.111.2...v0.112.0) (2024-03-07)


### Bug Fixes

* Remove log out message and update login message ([b939045](https://github.com/getappmap/vscode-appland/commit/b93904554c0632738eb9d80035c49dd6b55ae343))


### Features

* Users can activate with email ([b4f0eaa](https://github.com/getappmap/vscode-appland/commit/b4f0eaa9da6400357b35844dd43f28629c46dc79))

## [0.111.2](https://github.com/getappmap/vscode-appland/compare/v0.111.1...v0.111.2) (2024-03-06)


### Bug Fixes

* Skip minor version ([7785072](https://github.com/getappmap/vscode-appland/commit/77850722e20262c59425e7bda10b65651f5c547a))

## [0.111.1](https://github.com/getappmap/vscode-appland/compare/v0.111.0...v0.111.1) (2024-03-06)


### Bug Fixes

* Entering license manually closes sign in panel ([#895](https://github.com/getappmap/vscode-appland/issues/895)) ([a6ec5d3](https://github.com/getappmap/vscode-appland/commit/a6ec5d3f9bad94133ddd3e56d40eba4d5122bc1b))
* Update @appland/components to v4.5.0 ([3a5fcad](https://github.com/getappmap/vscode-appland/commit/3a5fcad33ec7c66114a65a864a31e8292d6d8b5d))

# [0.111.0](https://github.com/getappmap/vscode-appland/compare/v0.110.1...v0.111.0) (2024-02-29)


### Features

* The Navie view now explains AppMap concepts ([6e02d99](https://github.com/getappmap/vscode-appland/commit/6e02d9901d0700c0800d2a8847fa64655f510091))

## [0.110.1](https://github.com/getappmap/vscode-appland/compare/v0.110.0...v0.110.1) (2024-02-23)


### Bug Fixes

* Add video embeds to README ([#892](https://github.com/getappmap/vscode-appland/issues/892)) ([551c88a](https://github.com/getappmap/vscode-appland/commit/551c88af13c6e9469f557128ccd5efa11bb8a058))

# [0.110.0](https://github.com/getappmap/vscode-appland/compare/v0.109.1...v0.110.0) (2024-02-21)


### Bug Fixes

* Update Navie AI command ([9cb0e04](https://github.com/getappmap/vscode-appland/commit/9cb0e04b7a22cd5ecd1aba77980753faac07cd74))


### Features

* Update Navie chat interface ([#889](https://github.com/getappmap/vscode-appland/issues/889)) ([154598e](https://github.com/getappmap/vscode-appland/commit/154598e3ab9ea12b54cb856f0bdfaca4f034c1f0))
* Update readme ([37162c8](https://github.com/getappmap/vscode-appland/commit/37162c84b48593a5447c0c6b4d3c0a3760eed80d))

## [0.109.1](https://github.com/getappmap/vscode-appland/compare/v0.109.0...v0.109.1) (2024-02-17)


### Bug Fixes

* Update README.md ([0305da6](https://github.com/getappmap/vscode-appland/commit/0305da6a5a1e1f165b8b4639bf231f0fc64e7ee6))

# [0.109.0](https://github.com/getappmap/vscode-appland/compare/v0.108.0...v0.109.0) (2024-02-14)


### Features

* Add navie and remove explore appmaps and runtime analysis ([436f921](https://github.com/getappmap/vscode-appland/commit/436f9215bc2e02586bdfbe65fc50166cedebbec8))

# [0.108.0](https://github.com/getappmap/vscode-appland/compare/v0.107.0...v0.108.0) (2024-02-08)


### Bug Fixes

* Update @appland/components to v3.33.1 ([44fa3fc](https://github.com/getappmap/vscode-appland/commit/44fa3fcd72e98abc476347c5ec5ecf695b631b6e))


### Features

* Add more light bulb languages ([d2c0db3](https://github.com/getappmap/vscode-appland/commit/d2c0db36f6055e289c787186590e1e790ae40763))
* Rename Navie code action ([2b8908b](https://github.com/getappmap/vscode-appland/commit/2b8908b5cfa04dd76fe1644d693b6b5b79d85908))

# [0.107.0](https://github.com/getappmap/vscode-appland/compare/v0.106.0...v0.107.0) (2024-02-02)


### Bug Fixes

* Add cleanup of Disposable ([4d92c78](https://github.com/getappmap/vscode-appland/commit/4d92c7848c75751d242d56b69c5b9acb793a52e2))
* Add code block syntax highlighting ([019feb1](https://github.com/getappmap/vscode-appland/commit/019feb1325da9cc0136a0847cce3d4ea5c688b83))
* Drop extra padding in web view ([ae9c261](https://github.com/getappmap/vscode-appland/commit/ae9c2612b629178eb0fe4817e3cf6109dec99501))
* Ensure a deleted AppMap is removed from the tree ([b38847c](https://github.com/getappmap/vscode-appland/commit/b38847c8e221ec8e2c209a70628f719274f4900d))
* Source links with drive letters on Windows ([#849](https://github.com/getappmap/vscode-appland/issues/849)) ([b2a38ad](https://github.com/getappmap/vscode-appland/commit/b2a38add4dcd2339b6a785b6c04771195dfae34c))
* Support IPv6 when remote recording ([ddf8cd5](https://github.com/getappmap/vscode-appland/commit/ddf8cd5405492cb2be9cd9dcf8752ffb3ae48406))


### Features

* Allow configuration of AppMap API URL ([53de8c0](https://github.com/getappmap/vscode-appland/commit/53de8c0764bcda164ebceb3b95feae628f976d8a))
* AppMap AI: Explain ([c212a2c](https://github.com/getappmap/vscode-appland/commit/c212a2c04f5ef12ce0587eba0cac2d07aa9c499f))
* Configurable CLI flags ([e75bd92](https://github.com/getappmap/vscode-appland/commit/e75bd9217c622cc3f0d98025245cebbf08a13dde))
* Handle AppMap view state across views ([8747b75](https://github.com/getappmap/vscode-appland/commit/8747b75cb0c65c6a3cc02d4a67ccfbf50cde2b31))
* Handle exportJSON message from AppMap ([ba10c68](https://github.com/getappmap/vscode-appland/commit/ba10c685cb678d4efacf7fb02b149cbbecc16f4b))
* Integrate the code snippet frontend ([5092027](https://github.com/getappmap/vscode-appland/commit/5092027d022e1c850d58534b9793524853dd9fbe))
* Propagate savedFilters to the chatSearch view ([d3222df](https://github.com/getappmap/vscode-appland/commit/d3222df39fdba8c9f33895855b24e34c1f81603d))
* Remove 'performAction' events ([3ad2a68](https://github.com/getappmap/vscode-appland/commit/3ad2a6898eb13a0cbc0ddff555f6618a8568d54b))
* Update [@appland](https://github.com/appland) dependencies ([cbec983](https://github.com/getappmap/vscode-appland/commit/cbec983187d951f64fd55ea3bd3415d435540e77))
* Update @appland/components to 3.32.0 ([a86acad](https://github.com/getappmap/vscode-appland/commit/a86acad1b4bacf33c785f9dfc7aff03264328759))
* Update @appland/components to v3.33.0 ([909c185](https://github.com/getappmap/vscode-appland/commit/909c1854b9ef834a55597ccce04809672041681e))
* Update VSCode engine to v1.82.0 ([#858](https://github.com/getappmap/vscode-appland/issues/858)) ([5456750](https://github.com/getappmap/vscode-appland/commit/5456750817f7f4d2608404d8ea018e2a56fa74b2))
* Use .appmapignore to ignore certain directories ([9a31784](https://github.com/getappmap/vscode-appland/commit/9a31784e63cae68a223b70f1bb3016d0525549bc))
* User is prompted to choose a directory for Explain command ([0f371fe](https://github.com/getappmap/vscode-appland/commit/0f371fe3d6756d55725c57fa94547a548c64c337))

# [0.106.0](https://github.com/getappmap/vscode-appland/compare/v0.105.0...v0.106.0) (2024-01-12)


### Bug Fixes

* Propagate `http.proxy` setting to Yarn ([c2cce86](https://github.com/getappmap/vscode-appland/commit/c2cce86e0f19adce1feff166e80651635a6318d3))


### Features

* Update VSCode engine to v1.82.0 ([#858](https://github.com/getappmap/vscode-appland/issues/858)) ([001e765](https://github.com/getappmap/vscode-appland/commit/001e76570f84166886ca7cb884d77ca92f2d0b96))

# [0.105.0](https://github.com/getappmap/vscode-appland/compare/v0.104.0...v0.105.0) (2023-12-04)


### Features

* AppMap: Enter License Key ([ebb166d](https://github.com/getappmap/vscode-appland/commit/ebb166ddcba75a88538aecb5e41534cbe5649637))
* Update default AppMap server URL ([cb583ec](https://github.com/getappmap/vscode-appland/commit/cb583ec34380d78bfc0a0ab6e045d389ed8535b4))

# [0.104.0](https://github.com/getappmap/vscode-appland/compare/v0.103.0...v0.104.0) (2023-11-29)


### Bug Fixes

* Delete appmap reliably ([#834](https://github.com/getappmap/vscode-appland/issues/834)) ([d2c85d8](https://github.com/getappmap/vscode-appland/commit/d2c85d8bd94af799c1377b1a5fd24b92dee59ec1))
* Improve resource usage in file watchers and finders ([091f3db](https://github.com/getappmap/vscode-appland/commit/091f3db6403bed0bff16ded4f3542579499c8ce4)), closes [#839](https://github.com/getappmap/vscode-appland/issues/839)
* Use sql query as fallback for finding title ([9560546](https://github.com/getappmap/vscode-appland/commit/95605466b4f60c6b3102be06a2084c27cb0c1cc7))


### Features

* Update @appland/components to 3.13.2 ([b65153c](https://github.com/getappmap/vscode-appland/commit/b65153c134a6dd39da99bb983395142411bcaf3f))

# [0.103.0](https://github.com/getappmap/vscode-appland/compare/v0.102.0...v0.103.0) (2023-10-31)


### Features

* Update @appland/components to 3.9.0 ([fa2cc6e](https://github.com/getappmap/vscode-appland/commit/fa2cc6e56f96b13225d1a865a3972a4495eecf28))

# [0.102.0](https://github.com/getappmap/vscode-appland/compare/v0.101.2...v0.102.0) (2023-10-11)


### Bug Fixes

* AppMaps displayed chronologically for Java requests ([#813](https://github.com/getappmap/vscode-appland/issues/813)) ([4f8e730](https://github.com/getappmap/vscode-appland/commit/4f8e730be089000d8c2eb3e28b1226f39efaf0e4))
* Instructions page should be reactive to the Java agent file ([3bfbcb6](https://github.com/getappmap/vscode-appland/commit/3bfbcb602e53e19285e902a56e427c7f07fe2459))


### Features

* Accurately determine if Runtime Analysis step is complete ([#829](https://github.com/getappmap/vscode-appland/issues/829)) ([0dd1fa2](https://github.com/getappmap/vscode-appland/commit/0dd1fa2d61e5b7923c67bf0d1e051b2074df3120))
* The Code Objects view also lists External Service Calls ([d9b9c32](https://github.com/getappmap/vscode-appland/commit/d9b9c325edb40791d94353ccd3541baab1d241fa))
* Update [@appland](https://github.com/appland) dependencies ([d696a53](https://github.com/getappmap/vscode-appland/commit/d696a5388d158f827c97caf5db4242340d8b44eb))
* update @appland/components to 3.8.0 ([8b66898](https://github.com/getappmap/vscode-appland/commit/8b668983fe30602f5960836fe1d1120d6b28b31f))
* **deleteAppMaps.ts:** add closeEditorByUri function after deleting appmaps ([2a54b8c](https://github.com/getappmap/vscode-appland/commit/2a54b8cde5c5b0b5894185cfe63f78c0cd539e4e))

## [0.101.2](https://github.com/getappmap/vscode-appland/compare/v0.101.1...v0.101.2) (2023-09-21)


### Bug Fixes

* The runtime analysis now opens the findings overview ([#822](https://github.com/getappmap/vscode-appland/issues/822)) ([ebfba8b](https://github.com/getappmap/vscode-appland/commit/ebfba8b79de1f1fbe5eef3fccdb200317a1490a5))

## [0.101.1](https://github.com/getappmap/vscode-appland/compare/v0.101.0...v0.101.1) (2023-09-20)


### Bug Fixes

* Don't notify of new AppMaps on initialization ([428151c](https://github.com/getappmap/vscode-appland/commit/428151c0fff14dde55a863cd393a542dc660fe26))

# [0.101.0](https://github.com/getappmap/vscode-appland/compare/v0.100.0...v0.101.0) (2023-09-20)


### Bug Fixes

* Always show 'no projects found' when viewing instructions if no ([1ec4dbc](https://github.com/getappmap/vscode-appland/commit/1ec4dbcd5cc726dd5755b4c0aebbeb97a7e635ee))
* Clicking Code Object tree items should open AppMap ([f4572b2](https://github.com/getappmap/vscode-appland/commit/f4572b22d52c9dd09a1995b5964740031ceeb536))
* Clicking Code Object tree leaf items should open AppMap ([a29143f](https://github.com/getappmap/vscode-appland/commit/a29143fc655c8fe8913325776a4ff72ef72259f7))
* Clicking sign-in button cancels previous sign-in attempt ([9866fbc](https://github.com/getappmap/vscode-appland/commit/9866fbcd8e60b034c1fc369bac3d52654366a6ba))
* Close open editors when using the "delete AppMap" command ([#807](https://github.com/getappmap/vscode-appland/issues/807)) ([8ffb69d](https://github.com/getappmap/vscode-appland/commit/8ffb69d2346fa4596f068ab7550c5da74080b4ed))
* Drop the AppMap pin feature from VSCode ([84803ed](https://github.com/getappmap/vscode-appland/commit/84803ed95ea809ddf7878e0f399115a8bda68e82))
* Drop the AppMap pin feature from VSCode ([41829f5](https://github.com/getappmap/vscode-appland/commit/41829f561a3a4fe9856f75cd8e5d8a1b1a34b257))
* lock system tests to vs code version 1.81.1 ([39bb3f7](https://github.com/getappmap/vscode-appland/commit/39bb3f7f87b169269ae08764be954e4b07bc7cce))
* lock vs code version in integration tests ([ab3c4b8](https://github.com/getappmap/vscode-appland/commit/ab3c4b89f1ba6744a575e6d4106fcb024685574a))
* remove generate sequence diagram option for appmap ([93fae31](https://github.com/getappmap/vscode-appland/commit/93fae315ce17d4c8325fc8ac658c8d638d78aaa3))


### Features

* Display *.diff.sequence.json files ([b18b44a](https://github.com/getappmap/vscode-appland/commit/b18b44a7beff66012c5d355fa472bb4ad0116cee))
* New users see a notification box when they create their first map ([d5d6f3f](https://github.com/getappmap/vscode-appland/commit/d5d6f3fe2f87e70d300d8120dd5fc6a21723c4a7))
* Prompt java and python to install appmap ([1f6c57f](https://github.com/getappmap/vscode-appland/commit/1f6c57f79bd7d9c2027b9229a298900ca523ea43))
* Remove AppMap upload feature ([8d82438](https://github.com/getappmap/vscode-appland/commit/8d82438c2e93f6a5d6d439ba98a605367b3499c1))
* Rename AppMap auth provider to 'AppMap' ([1337301](https://github.com/getappmap/vscode-appland/commit/1337301164e1518e4106ffb58f45f3579f0b3546))
* select finding when opening from finding webview ([7c0a156](https://github.com/getappmap/vscode-appland/commit/7c0a156e03b8b25bcf8acd29df7c4cf06db29d38))
* select finding when opening from problems tab ([6e7eac3](https://github.com/getappmap/vscode-appland/commit/6e7eac37eff4cdf7cea3ab6254efc1984b4076e6))
* top level of runtime analysis tree is expanded by default ([d75c093](https://github.com/getappmap/vscode-appland/commit/d75c09359451bf4a4ede982fed88914110603d4e))
* Upgrade @appland/components to v2.62.0 ([ac0fbcc](https://github.com/getappmap/vscode-appland/commit/ac0fbcc050e1022f9395bf8d6dbf3355524a5636))

# [0.100.0](https://github.com/getappmap/vscode-appland/compare/v0.99.0...v0.100.0) (2023-08-31)


### Features

* Drop OpenAPI from the onboarding flow ([b9e7b58](https://github.com/getappmap/vscode-appland/commit/b9e7b587da971961595568994457f1283ef6d680))

# [0.99.0](https://github.com/getappmap/vscode-appland/compare/v0.98.1...v0.99.0) (2023-08-31)


### Features

* Clean up telemetry ([1c28a8a](https://github.com/getappmap/vscode-appland/commit/1c28a8ad825e398071a6e476ed248e9689ff7989))

## [0.98.1](https://github.com/getappmap/vscode-appland/compare/v0.98.0...v0.98.1) (2023-08-22)


### Bug Fixes

* update java jar instructions ([4348f5b](https://github.com/getappmap/vscode-appland/commit/4348f5b88e642acaa140d34f2adb07400aaee036))

# [0.98.0](https://github.com/getappmap/vscode-appland/compare/v0.97.1...v0.98.0) (2023-08-14)


### Features

* update @appland/components to 2.58.0 ([c31dae5](https://github.com/getappmap/vscode-appland/commit/c31dae5c6faf6713e2876bf52ee252ca89d14f8c))

## [0.97.1](https://github.com/getappmap/vscode-appland/compare/v0.97.0...v0.97.1) (2023-07-21)


### Bug Fixes

* update @appland/components to 2.57.0 ([3c45d82](https://github.com/getappmap/vscode-appland/commit/3c45d822a6db5c4b56e1ae383ab83a2c5fa3f626))

# [0.97.0](https://github.com/getappmap/vscode-appland/compare/v0.96.0...v0.97.0) (2023-07-17)


### Bug Fixes

* Java installation status reflects run configs and agent download ([6ed0ede](https://github.com/getappmap/vscode-appland/commit/6ed0edee289bb79bdebf5159940096511e88bf52))


### Features

* Update installation instructions for Python and Ruby ([26d18ea](https://github.com/getappmap/vscode-appland/commit/26d18ea2faca07eabb116a462ed7f9fc18f59fbc))

# [0.96.0](https://github.com/getappmap/vscode-appland/compare/v0.95.1...v0.96.0) (2023-07-12)


### Features

* update dependencies to release improved findings hightlighting ([15b29e6](https://github.com/getappmap/vscode-appland/commit/15b29e6817ca071850749d70a677743d52ff864d))

## [0.95.1](https://github.com/getappmap/vscode-appland/compare/v0.95.0...v0.95.1) (2023-07-11)


### Bug Fixes

* `Delete All AppMaps` will delete index directories if the AppMap has not yet been acknowledged ([8f19c8a](https://github.com/getappmap/vscode-appland/commit/8f19c8ac4815652832d7ae6cd20dfdfd385019df))
* AppMaps removed by project will be deleted ([b9bcbaa](https://github.com/getappmap/vscode-appland/commit/b9bcbaa7ec1e187bd3bb2dec4e9f65798166923a))
* Improve wait conditions for Python interpreter activation before running the installer ([3fdde29](https://github.com/getappmap/vscode-appland/commit/3fdde29c8092e2492c66e1009189567547517b07))

# [0.95.0](https://github.com/getappmap/vscode-appland/compare/v0.94.0...v0.95.0) (2023-07-10)


### Features

* remove flame graph feature flag ([d39a14b](https://github.com/getappmap/vscode-appland/commit/d39a14b839d732f269d878854751a9dcc86e0eff))

# [0.94.0](https://github.com/getappmap/vscode-appland/compare/v0.93.0...v0.94.0) (2023-07-05)


### Features

* appmaps are organized by project folder in sidebar ([ff4505d](https://github.com/getappmap/vscode-appland/commit/ff4505d42baef32eaee988b16bb8b3f38efb8e14))
* Integrate Java asset status in the instructions ([c553bcd](https://github.com/getappmap/vscode-appland/commit/c553bcd5d42f7f965f6c10bac5eff0d211102f12))
* move initialization of default AppMap filter to frontend ([9520a3d](https://github.com/getappmap/vscode-appland/commit/9520a3d32cf4f2c1218a5bc1a65c4673d8ea157a))

# [0.93.0](https://github.com/getappmap/vscode-appland/compare/v0.92.0...v0.93.0) (2023-06-30)


### Bug Fixes

* remote recording uses appmap_dir for output ([7ad70ab](https://github.com/getappmap/vscode-appland/commit/7ad70ab84e6e95758329bdd8dc453ad830c656e2))


### Features

* open appmap sign-in on installation ([ac34526](https://github.com/getappmap/vscode-appland/commit/ac345266b0333eb5969f10fcd0500c09b95fc21b))
* open appmap sign-in on installation ([6a106f6](https://github.com/getappmap/vscode-appland/commit/6a106f66ae7e756baf6dede7a68eaa549f1fb9ac))

# [0.92.0](https://github.com/getappmap/vscode-appland/compare/v0.91.1...v0.92.0) (2023-06-30)


### Features

* update flame graph ([e5f87eb](https://github.com/getappmap/vscode-appland/commit/e5f87eb089102bb22b847b150c4fd4f26cf1ad85))

## [0.91.1](https://github.com/getappmap/vscode-appland/compare/v0.91.0...v0.91.1) (2023-06-29)


### Bug Fixes

* remove sidebar panes when signed out ([9ffe1e2](https://github.com/getappmap/vscode-appland/commit/9ffe1e2cb099bfd8e35214a064da8829e8a8dc9f))

# [0.91.0](https://github.com/getappmap/vscode-appland/compare/v0.90.1...v0.91.0) (2023-06-28)


### Bug Fixes

* Await appmaps deletion ([1b391e8](https://github.com/getappmap/vscode-appland/commit/1b391e8f15f635e6f44decac619e2d5f6493268e))
* Enumerate files each time before deleting ([955439e](https://github.com/getappmap/vscode-appland/commit/955439e1e30cf716b4ede78234109da90668b677))


### Features

* Convert context menu commands to inline ([550cd48](https://github.com/getappmap/vscode-appland/commit/550cd4843194e97bf3b207b59796ca037812de88))
* Organize findings by date ([39eeb85](https://github.com/getappmap/vscode-appland/commit/39eeb851b4b4283aba263e76e7bcff9a83a81568))
* Show failed tests in the Analysis view ([9b6f0ac](https://github.com/getappmap/vscode-appland/commit/9b6f0acd60a6e92842982c3df44df133a3a12b4a))

## [0.90.1](https://github.com/getappmap/vscode-appland/compare/v0.90.0...v0.90.1) (2023-06-23)


### Bug Fixes

* java test config respects appmap_dir ([cfb3604](https://github.com/getappmap/vscode-appland/commit/cfb360439d34b6d7ea3eff76f5f16d9a944f905b))

# [0.90.0](https://github.com/getappmap/vscode-appland/compare/v0.89.1...v0.90.0) (2023-06-23)


### Features

* Introduce the installation status bar ([bb311e0](https://github.com/getappmap/vscode-appland/commit/bb311e06778d05c03aa0ed0564e13514cc981983))
* Reuse existing terminals when rerunning installer if possible ([1256af3](https://github.com/getappmap/vscode-appland/commit/1256af3e6699a2427956c21259e7c8d3475a8219)), closes [#703](https://github.com/getappmap/vscode-appland/issues/703)

## [0.89.1](https://github.com/getappmap/vscode-appland/compare/v0.89.0...v0.89.1) (2023-06-21)


### Bug Fixes

* do not report error when lockfile exists ([a393599](https://github.com/getappmap/vscode-appland/commit/a3935991f485c679f11943e2df65a56d0c4ba82d))
* throw error when assets not retrieved from github ([2e2bb85](https://github.com/getappmap/vscode-appland/commit/2e2bb85fa8339e1483fbbe94e0af997959a3f3f9))

# [0.89.0](https://github.com/getappmap/vscode-appland/compare/v0.88.1...v0.89.0) (2023-06-21)


### Features

* add flame graph setting ([d824f64](https://github.com/getappmap/vscode-appland/commit/d824f648ec698f47a243c29a61f912b14d581b20))

## [0.88.1](https://github.com/getappmap/vscode-appland/compare/v0.88.0...v0.88.1) (2023-06-21)


### Bug Fixes

* users can update an existing filter ([d7aa7df](https://github.com/getappmap/vscode-appland/commit/d7aa7df0e382cbd95ae6fb2a65284e0a8931a1c0))

# [0.88.0](https://github.com/getappmap/vscode-appland/compare/v0.87.1...v0.88.0) (2023-06-21)


### Features

* Ensure the latest cli version is used when installing agent in JS ([fc96f38](https://github.com/getappmap/vscode-appland/commit/fc96f38a9ae5f3c4add4d65927b92d81209520d2))

## [0.87.1](https://github.com/getappmap/vscode-appland/compare/v0.87.0...v0.87.1) (2023-06-20)


### Bug Fixes

* `appmap.project.language` is now sourced from project metadata ([264c51d](https://github.com/getappmap/vscode-appland/commit/264c51d4d9519b168ae4ed7ca81d7c4b863e5f3d))
* Don't send `appmap:create` on initialization ([0fc5a90](https://github.com/getappmap/vscode-appland/commit/0fc5a90cf43c6fb1bd21d7a1da3e8e361a7bc9d0))
* Drop the sequence diagram feedback prompt ([fd11b69](https://github.com/getappmap/vscode-appland/commit/fd11b698d70fb39c87e5d94af75e3426711052bf))

# [0.87.0](https://github.com/getappmap/vscode-appland/compare/v0.86.0...v0.87.0) (2023-06-20)


### Bug Fixes

* AppMaps are now removed from the list after deletion ([d4dca78](https://github.com/getappmap/vscode-appland/commit/d4dca780b45920ec12164ca8dbd992df660961a2))
* Record AppMaps instructions state is consistent across views ([f7ba65d](https://github.com/getappmap/vscode-appland/commit/f7ba65d1eb48f8b84bdb9de0a57eb201dde733de))


### Features

* Updated instructions content ([9050959](https://github.com/getappmap/vscode-appland/commit/90509590e36788efc7f1f9f2ccd94067b031da8f))

# [0.86.0](https://github.com/getappmap/vscode-appland/compare/v0.85.0...v0.86.0) (2023-06-15)


### Features

* add run and test configs for java users ([8ffacbe](https://github.com/getappmap/vscode-appland/commit/8ffacbefb510808a24e72319d28325fdd1b64965))
* command to download latest java agent jar ([8cc8966](https://github.com/getappmap/vscode-appland/commit/8cc896609abed5564baa6b4760ecf976f8f1b4e1))
* commands to update launch and test configs ([e5e1aeb](https://github.com/getappmap/vscode-appland/commit/e5e1aeb83ee1d13e7c69988d00f9f541989ebc22))
* download latest java agent jar file ([5e8c694](https://github.com/getappmap/vscode-appland/commit/5e8c6949aeb298daf47b4a40566380cf3bcff898))
* Look for JavaScript dependencies in lockfiles ([face65f](https://github.com/getappmap/vscode-appland/commit/face65fd797adc2f06931298fac9052668d78362)), closes [#711](https://github.com/getappmap/vscode-appland/issues/711)

# [0.85.0](https://github.com/getappmap/vscode-appland/compare/v0.84.0...v0.85.0) (2023-06-08)


### Features

* Collapse views until the user opens them ([ee7b5ba](https://github.com/getappmap/vscode-appland/commit/ee7b5baf2a0f72aa5791376213a8aa0aaa7ebba9))
* Limit choices for default instructions ([d23170c](https://github.com/getappmap/vscode-appland/commit/d23170c899499a97f4c8026ac76a6ab7e2c2341b))
* Prompt the user to perform setup ([1109490](https://github.com/getappmap/vscode-appland/commit/11094904f967005822fbefbb1a8ab6183b603729))
* Python installer leverages the Python extension ([289912e](https://github.com/getappmap/vscode-appland/commit/289912e6ce86cfd09f4271318bd8c916f9f18b4b))

# [0.84.0](https://github.com/getappmap/vscode-appland/compare/v0.83.0...v0.84.0) (2023-06-07)


### Features

* User can configure default appmap filter settings ([#683](https://github.com/getappmap/vscode-appland/issues/683)) ([60a41c6](https://github.com/getappmap/vscode-appland/commit/60a41c6ffab6c81a35e51d816f56e552736c8075))

# [0.83.0](https://github.com/getappmap/vscode-appland/compare/v0.82.1...v0.83.0) (2023-06-06)


### Bug Fixes

* Don't introduce extra newlines parsing depends ([6425250](https://github.com/getappmap/vscode-appland/commit/6425250c27f23fc637278ee422943e3c0e2383bf))


### Features

* Prefer first language with a web framework ([b560d78](https://github.com/getappmap/vscode-appland/commit/b560d7892333ee9db73bbd5ce13ea2651ea7630a))
* Rename language and feature status ([b99d805](https://github.com/getappmap/vscode-appland/commit/b99d80589fd382b1e0a073acc18791ee7c22c189))
* Tighten install prompt criteria slightly ([5c7bd7c](https://github.com/getappmap/vscode-appland/commit/5c7bd7c54c27dd8cb79e4cb40914d8eda3c03aab))
* Use warning icon when AppMap test_status is failed ([12ce3e2](https://github.com/getappmap/vscode-appland/commit/12ce3e2761f0bd5fc8d364987b04189f62d98d85))

## [0.82.1](https://github.com/getappmap/vscode-appland/compare/v0.82.0...v0.82.1) (2023-06-05)


### Bug Fixes

* revert "build: bump components peer dependency" ([3d80170](https://github.com/getappmap/vscode-appland/commit/3d80170cfdab7f8c17554700a85259632bbc4dc0))
* revert "feat: add flame graph setting" ([877f5b2](https://github.com/getappmap/vscode-appland/commit/877f5b2cef2a4b3f50f4934222e5510429825492))

# [0.82.0](https://github.com/getappmap/vscode-appland/compare/v0.81.2...v0.82.0) (2023-06-05)


### Features

* add flame graph setting ([3f4769c](https://github.com/getappmap/vscode-appland/commit/3f4769cfce4dc62689faa377626662343af431d4))

## [0.81.2](https://github.com/getappmap/vscode-appland/compare/v0.81.1...v0.81.2) (2023-05-30)


### Bug Fixes

* More verbose telemetry on locking and tool installation failure ([741bd53](https://github.com/getappmap/vscode-appland/commit/741bd53844c997c21a27c3227d2e308777d6d5a1))

## [0.81.1](https://github.com/getappmap/vscode-appland/compare/v0.81.0...v0.81.1) (2023-05-20)


### Bug Fixes

* Look for appmaps in subprojects ([6290bbd](https://github.com/getappmap/vscode-appland/commit/6290bbd88cf15b06e3bfc08b012951a5f39c3b8d))

# [0.81.0](https://github.com/getappmap/vscode-appland/compare/v0.80.0...v0.81.0) (2023-05-18)


### Features

* add web and test framework to project:open ([a2fe20c](https://github.com/getappmap/vscode-appland/commit/a2fe20c28904847e2f5c0ba5b39ee512f3fa2d4a))

# [0.80.0](https://github.com/getappmap/vscode-appland/compare/v0.79.2...v0.80.0) (2023-05-15)


### Features

* expand packages in seq diagram ([0a63f62](https://github.com/getappmap/vscode-appland/commit/0a63f62c186ec3223bb88acb8b3dfd35262076c1))

## [0.79.2](https://github.com/getappmap/vscode-appland/compare/v0.79.1...v0.79.2) (2023-05-11)


### Bug Fixes

* remove broken docs links ([0907a5e](https://github.com/getappmap/vscode-appland/commit/0907a5ea6fb4d997672b31dcf79496683e82e8c5))

## [0.79.1](https://github.com/getappmap/vscode-appland/compare/v0.79.0...v0.79.1) (2023-05-11)


### Bug Fixes

* Use a stable node bin path when running the install CLI ([812fd79](https://github.com/getappmap/vscode-appland/commit/812fd79f16c8df18215e080c01f4fb7d3a3ea5a3))

# [0.79.0](https://github.com/getappmap/vscode-appland/compare/v0.78.0...v0.79.0) (2023-05-08)


### Features

* update sign-in flow ([8e651dd](https://github.com/getappmap/vscode-appland/commit/8e651dd2eac8152023451dbe406e775254b919f2))

# [0.78.0](https://github.com/getappmap/vscode-appland/compare/v0.77.0...v0.78.0) (2023-05-04)


### Features

* Trigger release of new marketplace desc ([13e425a](https://github.com/getappmap/vscode-appland/commit/13e425aa99926ac202d0289160e37d0cc1e3cee9))

# [0.77.0](https://github.com/getappmap/vscode-appland/compare/v0.76.0...v0.77.0) (2023-05-01)


### Bug Fixes

* Don't catch the wrong exception ([d11f8e0](https://github.com/getappmap/vscode-appland/commit/d11f8e019fa8c3d8ebd08b81997d39a21a975083))
* Don't parse every AppMap as its observed ([7c69a92](https://github.com/getappmap/vscode-appland/commit/7c69a92162e603a8fe27ae340ee0d2232583c1db))
* Remove command 'openMostRecentlyModifiedAppMap' since it has no implementation ([701fe47](https://github.com/getappmap/vscode-appland/commit/701fe47fb8c2a384a1595ef0213dacd019bd8cfb))
* Remove unneeded async ([a01e19d](https://github.com/getappmap/vscode-appland/commit/a01e19d573f1854b6615c0987703e82e1fedf5a5))
* Typo ([d184b49](https://github.com/getappmap/vscode-appland/commit/d184b49b5288d0a80c975df3a13b598c51f618c2))
* Use Map as a Map, not as an Object ([5504466](https://github.com/getappmap/vscode-appland/commit/550446627a1ae0f9de50b6ffeedba2391734b87e))


### Features

* Delete all AppMaps only from appmap_dir ([9ce14a4](https://github.com/getappmap/vscode-appland/commit/9ce14a4c7a76f53bfc20dc3f2267110a106ffab5))
* Open AppMap by Name uses enhanced prompt ([48f5850](https://github.com/getappmap/vscode-appland/commit/48f5850eb0e3c0e03a0c570f3311f1fd9421cff0))
* Open Code Object in AppMap uses enhanced prompt ([b21deb4](https://github.com/getappmap/vscode-appland/commit/b21deb406bc72ee018bc6c81a6bbcea676f9bddc))
* Print a debug log message when deleting an AppMap ([41a444a](https://github.com/getappmap/vscode-appland/commit/41a444ac84aa72052c252424d6c0fe39cc447074))
* Print a warning before retrying ([ac45350](https://github.com/getappmap/vscode-appland/commit/ac453501bcbd0697d25c6ab144048f3e4dc21ff0))
* Use default exclude configuration for identifying appmap.yml ([89da5c0](https://github.com/getappmap/vscode-appland/commit/89da5c0c2754fd65a3db48336995d98293f98b9e))
* Watch only legal appmap dirs for appmap changes ([ecb81f6](https://github.com/getappmap/vscode-appland/commit/ecb81f65c4976ede56b3a14e80a63cb472d89852))

# [0.76.0](https://github.com/getappmap/vscode-appland/compare/v0.75.0...v0.76.0) (2023-04-28)


### Features

* Update the sign in flow ([#670](https://github.com/getappmap/vscode-appland/issues/670)) ([cf1e1cb](https://github.com/getappmap/vscode-appland/commit/cf1e1cb97713f8bf9a49dbc1fed4cf4e85b42856))

# [0.75.0](https://github.com/getappmap/vscode-appland/compare/v0.74.0...v0.75.0) (2023-04-24)


### Features

* Recognize jest support in the project picker ([a6cba2e](https://github.com/getappmap/vscode-appland/commit/a6cba2e62d346ca9f78315e3b72b0d021a3f0329))

# [0.74.0](https://github.com/getappmap/vscode-appland/compare/v0.73.0...v0.74.0) (2023-04-19)


### Features

* improved support for monorepos ([496c4ee](https://github.com/getappmap/vscode-appland/commit/496c4ee5eec8258f1094fd5f5382421f428fcb61))

# [0.73.0](https://github.com/getappmap/vscode-appland/compare/v0.72.0...v0.73.0) (2023-04-13)


### Features

* release updates to sidebar sign-in ([543aa69](https://github.com/getappmap/vscode-appland/commit/543aa69e34c6c67614c706ffc16520cabb69584f))

# [0.72.0](https://github.com/getappmap/vscode-appland/compare/v0.71.1...v0.72.0) (2023-04-06)


### Features

* make sequence diagram the default view ([e21f4a1](https://github.com/getappmap/vscode-appland/commit/e21f4a127133be669e0038ab4149183ef140d9d7))

## [0.71.1](https://github.com/getappmap/vscode-appland/compare/v0.71.0...v0.71.1) (2023-04-03)


### Bug Fixes

* eliminate linter warnings ([81d9756](https://github.com/getappmap/vscode-appland/commit/81d9756fefc57894d56009182f3389691239abd9))

# [0.71.0](https://github.com/getappmap/vscode-appland/compare/v0.70.2...v0.71.0) (2023-03-27)


### Features

* attach stats to appmap ([18c8d28](https://github.com/getappmap/vscode-appland/commit/18c8d288ac40077865af5b790da1eaab0ed67e80))

## [0.70.2](https://github.com/getappmap/vscode-appland/compare/v0.70.1...v0.70.2) (2023-03-22)


### Bug Fixes

* Don't infinitely retry crashed processes ([cabfc49](https://github.com/getappmap/vscode-appland/commit/cabfc49ea768d7382d986db04483d891a0e3bca4))
* Upgrade @appland/components, @appland/sequence-diagram ([dc60c08](https://github.com/getappmap/vscode-appland/commit/dc60c08e0d2d4ee3d8b624c6c166dfa877fcda23))

## [0.70.1](https://github.com/getappmap/vscode-appland/compare/v0.70.0...v0.70.1) (2023-03-10)


### Bug Fixes

* correct stack trace rendering in findings webview ([fe01ce1](https://github.com/getappmap/vscode-appland/commit/fe01ce176abf87c4d4713c734696a66bb35e4d79))
* correctly create uris in windows ([16b58cb](https://github.com/getappmap/vscode-appland/commit/16b58cb42f8336bf851e0c1edc365501ef0b804e))
* re-enable initial state when opening an appmap ([bba1d52](https://github.com/getappmap/vscode-appland/commit/bba1d520f252da814f0e1f88dcd37fbb8d93efb0))

# [0.70.0](https://github.com/getappmap/vscode-appland/compare/v0.69.0...v0.70.0) (2023-03-07)


### Features

* notify each webview when active editor tab changes ([9fa8fc3](https://github.com/getappmap/vscode-appland/commit/9fa8fc3d68305fe87e1cdb9106ce344d9d1baa67))
* prompt user for feedback about sequence diagrams ([4bcf444](https://github.com/getappmap/vscode-appland/commit/4bcf444fa7b4157de1259f7ebebbc3c1857136ef))

# [0.69.0](https://github.com/getappmap/vscode-appland/compare/v0.68.1...v0.69.0) (2023-03-03)


### Bug Fixes

* Improve sign-in webview styling ([#641](https://github.com/getappmap/vscode-appland/issues/641)) ([cc1a990](https://github.com/getappmap/vscode-appland/commit/cc1a990491115f47a501eef526658c92a51b731a))


### Features

* Include git repository upstream url in telemetry ([3b91de1](https://github.com/getappmap/vscode-appland/commit/3b91de18a12c7361f9002d0947d37f712147ec83))
* Report project directory in project:open telemetry message ([c2beaa2](https://github.com/getappmap/vscode-appland/commit/c2beaa25ebb5b299791cbfcf233717231d318c0b))

## [0.68.1](https://github.com/getappmap/vscode-appland/compare/v0.68.0...v0.68.1) (2023-03-01)


### Bug Fixes

* Opening AppMaps via the code objects tree works on Windows ([d48ff47](https://github.com/getappmap/vscode-appland/commit/d48ff47ac8c35261ac71b1b3b70d4c86b89c3367))
* reduce scanning for appmap.yml ([a897e5d](https://github.com/getappmap/vscode-appland/commit/a897e5d7a585785736de7d90c7bdfcbb375d2e29))
* Use best fit path when opening source of a code object ([3805634](https://github.com/getappmap/vscode-appland/commit/38056345ca6ae7226baca72f19e9508189388965))

# [0.68.0](https://github.com/getappmap/vscode-appland/compare/v0.67.2...v0.68.0) (2023-03-01)


### Features

* Add sequence diagrams to the AppMap viewer ([#615](https://github.com/getappmap/vscode-appland/issues/615)) ([9be5d69](https://github.com/getappmap/vscode-appland/commit/9be5d69c370c470ccf4a1f47ab49623a5f03efa1))

## [0.67.2](https://github.com/getappmap/vscode-appland/compare/v0.67.1...v0.67.2) (2023-02-24)


### Bug Fixes

* do not let users bypass sign-in ([c52a192](https://github.com/getappmap/vscode-appland/commit/c52a192128ec863b472ce68a67cceac8f0390b18))

## [0.67.1](https://github.com/getappmap/vscode-appland/compare/v0.67.0...v0.67.1) (2023-02-23)


### Bug Fixes

* Avoid a crash on appmaps without collection metadata ([d915b90](https://github.com/getappmap/vscode-appland/commit/d915b90d8a8c1df37d06ec76f3ab74b56e4c3efc))

# [0.67.0](https://github.com/getappmap/vscode-appland/compare/v0.66.2...v0.67.0) (2023-02-22)


### Features

* require sign in for new users ([33efa92](https://github.com/getappmap/vscode-appland/commit/33efa92581609022b2cbd7f2f26b6d7314ea5d0f))

## [0.66.2](https://github.com/getappmap/vscode-appland/compare/v0.66.1...v0.66.2) (2023-02-14)


### Bug Fixes

* Update README.md ([59344a1](https://github.com/getappmap/vscode-appland/commit/59344a1526504ef610dea1f2356718ce23bc13d3))

## [0.66.1](https://github.com/getappmap/vscode-appland/compare/v0.66.0...v0.66.1) (2023-02-13)


### Bug Fixes

* Make sure spawned processes quit correctly ([69dcf0f](https://github.com/getappmap/vscode-appland/commit/69dcf0f62be6466a3a5a4c74a37781db5ba48a29))
* Wait for process termination in process watcher ([eb8486f](https://github.com/getappmap/vscode-appland/commit/eb8486f98666c67098eea37353cb142cfa879ec4))

# [0.66.0](https://github.com/getappmap/vscode-appland/compare/v0.65.1...v0.66.0) (2023-02-07)


### Features

* update sign up CTA text ([481783e](https://github.com/getappmap/vscode-appland/commit/481783ec17a835ee0d2b63c5405f674e9e75b86b))

## [0.65.1](https://github.com/getappmap/vscode-appland/compare/v0.65.0...v0.65.1) (2023-02-03)


### Bug Fixes

* Update [@appland](https://github.com/appland) dependencies ([65aeba9](https://github.com/getappmap/vscode-appland/commit/65aeba9e6cd89a7eacb2677f68e4a68fa7090894))

# [0.65.0](https://github.com/getappmap/vscode-appland/compare/v0.64.0...v0.65.0) (2023-02-02)


### Features

* telemetry to understand where to put sign-in ([4d6ffe6](https://github.com/getappmap/vscode-appland/commit/4d6ffe6b75e067eb115814be65368dce20f337be))

# [0.64.0](https://github.com/getappmap/vscode-appland/compare/v0.63.1...v0.64.0) (2023-02-02)


### Bug Fixes

* Respect `appmap_dir` when generating OpenAPI ([d7a4010](https://github.com/getappmap/vscode-appland/commit/d7a40104db3db5dd6f7c38c1dbaaa2d9a346f527))


### Features

* share button behind feature flag ([fdee697](https://github.com/getappmap/vscode-appland/commit/fdee697da7def734aa8e175f1ab5b28fc7163ab7))

## [0.63.1](https://github.com/getappmap/vscode-appland/compare/v0.63.0...v0.63.1) (2023-01-20)


### Bug Fixes

* revert sidebar updates ([6464877](https://github.com/getappmap/vscode-appland/commit/6464877cfeb23cc70116f9b1eb4dd81ab149a239))

# [0.63.0](https://github.com/getappmap/vscode-appland/compare/v0.62.0...v0.63.0) (2023-01-18)


### Bug Fixes

* Remove unnecessary await ([3caf13c](https://github.com/getappmap/vscode-appland/commit/3caf13c8fa56b4f0ee4278ef0c43b0e7383acabc))
* Unwind use of ProjectState ([ed71ec1](https://github.com/getappmap/vscode-appland/commit/ed71ec15fa2ea076e8789b783504bf56034b9883))


### Features

* Provide api key to scanner process ([fd69280](https://github.com/getappmap/vscode-appland/commit/fd69280182e26f1879476928079bc8c14a4de5c5))

# [0.62.0](https://github.com/getappmap/vscode-appland/compare/v0.61.1...v0.62.0) (2023-01-17)


### Features

* add terms of service to readme ([3574931](https://github.com/getappmap/vscode-appland/commit/3574931a338a0de008a1b32b769bac1bdf348c5a))

## [0.61.1](https://github.com/getappmap/vscode-appland/compare/v0.61.0...v0.61.1) (2023-01-13)


### Bug Fixes

* Update @appland/appmap and @appland/scanner properly ([6614046](https://github.com/getappmap/vscode-appland/commit/66140464673321cf581facbed515a700100a25ae))

# [0.61.0](https://github.com/getappmap/vscode-appland/compare/v0.60.0...v0.61.0) (2023-01-12)


### Features

* add appmap to recommended extensions ([7c4425d](https://github.com/getappmap/vscode-appland/commit/7c4425dad980b28d6137f01c6a276c57c5238fda))

# [0.60.0](https://github.com/getappmap/vscode-appland/compare/v0.59.1...v0.60.0) (2023-01-12)


### Features

* share button updates ([2245b81](https://github.com/getappmap/vscode-appland/commit/2245b81172675b0f7b90ec4df29a56672a684c4d))

## [0.59.1](https://github.com/getappmap/vscode-appland/compare/v0.59.0...v0.59.1) (2023-01-12)


### Bug Fixes

* Override environment yarn configuration ([2871c49](https://github.com/getappmap/vscode-appland/commit/2871c49e2573c52d2f9de7890e47e8bbf8ce4934))

# [0.59.0](https://github.com/getappmap/vscode-appland/compare/v0.58.2...v0.59.0) (2023-01-06)


### Features

* Present findings information within AppMap view ([#551](https://github.com/getappmap/vscode-appland/issues/551)) ([b2ef538](https://github.com/getappmap/vscode-appland/commit/b2ef538251511292c9b90d26f1fb92071d82099f))

## [0.58.2](https://github.com/getappmap/vscode-appland/compare/v0.58.1...v0.58.2) (2022-12-22)


### Bug Fixes

* Use `child_process.fork` for launching sub-processes ([#569](https://github.com/getappmap/vscode-appland/issues/569)) ([8a7de10](https://github.com/getappmap/vscode-appland/commit/8a7de1045cd7947bf2b04ae864a4173739e6cbbd))

## [0.58.1](https://github.com/getappmap/vscode-appland/compare/v0.58.0...v0.58.1) (2022-12-21)


### Bug Fixes

* Revert "feat: Recognize support of Jest testing framework" ([0efe031](https://github.com/getappmap/vscode-appland/commit/0efe03172e3649f10a02e943b94cbdd22268a7cc))


### Reverts

* Revert "Bump loader-utils version pins" ([d8dd41d](https://github.com/getappmap/vscode-appland/commit/d8dd41d4bc6fee37308a51db30b6c975ed0df3bc))
* Revert "Bump typescript and ts-loader versions" ([2f62c93](https://github.com/getappmap/vscode-appland/commit/2f62c93f39563411a0e09a156158b755f9e0effe))
* Revert "Update @types/node to ^16" ([81e2068](https://github.com/getappmap/vscode-appland/commit/81e20687725ef8e8b44770703f8bdea4a6e8732b))
* Revert "Update ts-node" ([4e7780b](https://github.com/getappmap/vscode-appland/commit/4e7780b6cea3e5f9acf1c871af38a724e100c7ec))
* Revert "Load project analyzers statically" ([9df6cdf](https://github.com/getappmap/vscode-appland/commit/9df6cdf9a311fea60e4732df0bd34b00c6e2de38))
* Revert "feat: Recognize support of Jest testing framework" ([1df57ea](https://github.com/getappmap/vscode-appland/commit/1df57eaee4455ee8e111fbd50680e747f83bd304))

# [0.58.0](https://github.com/getappmap/vscode-appland/compare/v0.57.2...v0.58.0) (2022-12-21)


### Features

* Recognize support of Jest testing framework ([c7408f4](https://github.com/getappmap/vscode-appland/commit/c7408f4cd22f5f0bf9abe2a38809e999660e68e1)), closes [#554](https://github.com/getappmap/vscode-appland/issues/554)

## [0.57.2](https://github.com/getappmap/vscode-appland/compare/v0.57.1...v0.57.2) (2022-12-20)


### Bug Fixes

* Drop the front-end sign-up prompt ([41f2d9b](https://github.com/getappmap/vscode-appland/commit/41f2d9b14d67b2f387f650ec971a358e2a2d6ee0))

## [0.57.1](https://github.com/getappmap/vscode-appland/compare/v0.57.0...v0.57.1) (2022-12-20)


### Bug Fixes

* Set YARN_CHECKSUM_BEHAVIOR=update when 'yarn up' is called ([577526c](https://github.com/getappmap/vscode-appland/commit/577526c61852690ffb46e1bd34a4765a8994af94))

# [0.57.0](https://github.com/getappmap/vscode-appland/compare/v0.56.2...v0.57.0) (2022-12-20)


### Bug Fixes

* Drop the immediate sign-in prompt ([4901f57](https://github.com/getappmap/vscode-appland/commit/4901f576cddb9134b4aa6ffb860c624aed355b27))


### Features

* Emit telemtry for sequence diagrams ([c2d113f](https://github.com/getappmap/vscode-appland/commit/c2d113fcac0a808a211ae144c7379634d0830d97))

## [0.56.2](https://github.com/getappmap/vscode-appland/compare/v0.56.1...v0.56.2) (2022-12-16)


### Bug Fixes

* `getRecords` now returns nested objects and enforces value type ([34fcd28](https://github.com/getappmap/vscode-appland/commit/34fcd286bc5a02e3056bf66d581e14212474da01))

## [0.56.1](https://github.com/getappmap/vscode-appland/compare/v0.56.0...v0.56.1) (2022-12-16)


### Bug Fixes

* Notify on findings views ([90bfc64](https://github.com/getappmap/vscode-appland/commit/90bfc64035a54b0ff286b6b78a3439c4ab8f9f4b))

# [0.56.0](https://github.com/getappmap/vscode-appland/compare/v0.55.0...v0.56.0) (2022-12-13)


### Features

* Add dashboard and details pages for Runtime Analysis ([#519](https://github.com/getappmap/vscode-appland/issues/519)) ([88f3df8](https://github.com/getappmap/vscode-appland/commit/88f3df8a7c8c80249ec7ee92f790aa118e40fb77))
* Prompt the user to sign in before viewing instructions if they're not authenticated ([3827287](https://github.com/getappmap/vscode-appland/commit/38272871e44fb43f9448143dbeb5b4a37206e10a))

# [0.55.0](https://github.com/getappmap/vscode-appland/compare/v0.54.0...v0.55.0) (2022-12-05)


### Features

* Send machine id to AppMap Server auth ([b803c52](https://github.com/getappmap/vscode-appland/commit/b803c521a603fe6948fe16f0757bb49731fda858))

# [0.54.0](https://github.com/getappmap/vscode-appland/compare/v0.53.0...v0.54.0) (2022-11-30)


### Features

* Remove sequence diagram feature flag ([90b072f](https://github.com/getappmap/vscode-appland/commit/90b072fac62c1c696501a452583285b3e1c8f1bd))

# [0.53.0](https://github.com/getappmap/vscode-appland/compare/v0.52.2...v0.53.0) (2022-11-29)


### Bug Fixes

* Wait for `yarn up` before releasing installation lock ([41d0cf3](https://github.com/getappmap/vscode-appland/commit/41d0cf39dd71ddd6907817c54c69e9bdad3827ce))


### Features

* Send process logs in telemetry on failure ([c0a8f5a](https://github.com/getappmap/vscode-appland/commit/c0a8f5a58bf883c5e140c9b64d48138af33a8d6f)), closes [#510](https://github.com/getappmap/vscode-appland/issues/510)

## [0.52.2](https://github.com/getappmap/vscode-appland/compare/v0.52.1...v0.52.2) (2022-11-29)


### Bug Fixes

* Acquire a lock before attempting to install node dependencies ([1f3c7b8](https://github.com/getappmap/vscode-appland/commit/1f3c7b892875ae846c1d48ae74472035663c8849))
* Notify the user when OpenAPI generation fails ([b897f96](https://github.com/getappmap/vscode-appland/commit/b897f961e9877214f9ed598b0c10323897035d17))
* Unpin end-user CLI and scanner versions ([14884cf](https://github.com/getappmap/vscode-appland/commit/14884cf4d4979749122af6b9cc9c6c077d08e934))

## [0.52.1](https://github.com/getappmap/vscode-appland/compare/v0.52.0...v0.52.1) (2022-11-17)


### Bug Fixes

* AppMap CLI and scanner processes will now specify --appmap-dir ([f24fa59](https://github.com/getappmap/vscode-appland/commit/f24fa5928821cac186b009f4411a99745d999278))
* Create `appmap_dir` if it doesn't already exist before launching ([354161d](https://github.com/getappmap/vscode-appland/commit/354161d77298889ccd954c30604ff2fe9512e7dd))

# [0.52.0](https://github.com/getappmap/vscode-appland/compare/v0.51.0...v0.52.0) (2022-11-16)


### Features

* Prompt users to install AppMap to installable projects ([fe74ee4](https://github.com/getappmap/vscode-appland/commit/fe74ee46a66954206e1b3dfdab1fe1c04ad73f5b))

# [0.51.0](https://github.com/getappmap/vscode-appland/compare/v0.50.0...v0.51.0) (2022-11-12)


### Features

* Bump embedded CLI version pin to 3.49.2 ([c5bcadd](https://github.com/getappmap/vscode-appland/commit/c5bcadd58c146a935fe8ff0249dee7e8305a2011))

# [0.50.0](https://github.com/getappmap/vscode-appland/compare/v0.49.3...v0.50.0) (2022-11-11)


### Bug Fixes

* Can't save to undeclared settings ([0eaf552](https://github.com/getappmap/vscode-appland/commit/0eaf5521a6d0512b98ee1366390b16bc8684141c))
* Fix sequence diagram imports ([01682c8](https://github.com/getappmap/vscode-appland/commit/01682c8d73dff3a0ff76b37c3c2819f6fba8b056))


### Features

* Add plantUmlJarPath ([80c33dc](https://github.com/getappmap/vscode-appland/commit/80c33dc5df8c87c2886c7475953bc640bad2e6ff))
* Bundle PlantUML JAR file, with license ([ca77f0e](https://github.com/getappmap/vscode-appland/commit/ca77f0ebca1657c4e2030224373f1e5cf01716c0))
* Compare two sequence diagrams ([488d560](https://github.com/getappmap/vscode-appland/commit/488d56030e7a111120599d62c7944df3e29f2317))
* Create sequence diagram ([d5e0953](https://github.com/getappmap/vscode-appland/commit/d5e0953860389baec78c5ac0d5b0f082b133e194))
* Display appmap description and detail ([e8976cd](https://github.com/getappmap/vscode-appland/commit/e8976cd78602c091f4bcbd044ae8111bc864dc61))
* Inform user when diagram generation fails ([9e4d30f](https://github.com/getappmap/vscode-appland/commit/9e4d30f0b929c6252df3f48e5b867905b52aecbd))
* Manage collections of AppMaps ([09a04ff](https://github.com/getappmap/vscode-appland/commit/09a04ff4f780b8e5205e3d8be3663227dbe987ce))
* Properly enable/disable commands ([48b12bb](https://github.com/getappmap/vscode-appland/commit/48b12bb3b696b1b3f520610f99031b2fbefe2227))

## [0.49.3](https://github.com/getappmap/vscode-appland/compare/v0.49.2...v0.49.3) (2022-11-08)


### Bug Fixes

* Add debugging information for JS supported dependencies ([33296d6](https://github.com/getappmap/vscode-appland/commit/33296d6c61276f599d22edd9759a595043915a54))
* Emit whether or not a project is installable ([dff02fc](https://github.com/getappmap/vscode-appland/commit/dff02fc61ac18cf7ba40288f1e1d3c5156eb38b8))
* Emit whether or not the project contains a devcontainer config ([18d7ddc](https://github.com/getappmap/vscode-appland/commit/18d7ddc10fabcb0fa8fdc41b854d5d3519d61f7d))

## [0.49.2](https://github.com/getappmap/vscode-appland/compare/v0.49.1...v0.49.2) (2022-11-08)


### Bug Fixes

* Don't fail when checking if the project root is ignored ([bd9238c](https://github.com/getappmap/vscode-appland/commit/bd9238c3879cb5facb786aeec735df86a776ca13))

## [0.49.1](https://github.com/getappmap/vscode-appland/compare/v0.49.0...v0.49.1) (2022-11-07)


### Bug Fixes

* Add [@latest](https://github.com/latest) tag in install prompt. ([72bfd14](https://github.com/getappmap/vscode-appland/commit/72bfd1465b6ccb99b51f20c73064c0b9fe3b96e4))
* Gracefully handle unreadable gitignore files ([31fb745](https://github.com/getappmap/vscode-appland/commit/31fb745dd9a52bfe9cf1aab15a62b027981f11d2))
* Prevent semver comparison with 'latest' ([0967b0c](https://github.com/getappmap/vscode-appland/commit/0967b0c58880db9a67213af93988eeba03ab3770))

# [0.49.0](https://github.com/getappmap/vscode-appland/compare/v0.48.7...v0.49.0) (2022-11-01)


### Bug Fixes

* always quote paths in windows ([b7136e1](https://github.com/getappmap/vscode-appland/commit/b7136e1823bdaa06d561bffb6309b69ef1f50fd4))
* tests reflect path quoting in windows ([9a2395d](https://github.com/getappmap/vscode-appland/commit/9a2395d9fdc88f02dca7b07f20f26bbb291487c9))


### Features

* send info on default terminals in telemetry ([f57b8ab](https://github.com/getappmap/vscode-appland/commit/f57b8ab5ee3e3630a6db242f56a003ce8b5c7db8))

## [0.48.7](https://github.com/getappmap/vscode-appland/compare/v0.48.6...v0.48.7) (2022-10-28)


### Bug Fixes

* Strip paths of any extra leading path separators ([9c815f9](https://github.com/getappmap/vscode-appland/commit/9c815f998497f4ae22aba80588e278757853447a))
* Strip trailing Windows path separators from gitignore items ([9cb3b20](https://github.com/getappmap/vscode-appland/commit/9cb3b2057e5e906b161f1b731c1e4158795f6879))

## [0.48.6](https://github.com/getappmap/vscode-appland/compare/v0.48.5...v0.48.6) (2022-10-28)


### Bug Fixes

* Don't emit an error when a watched process is stopped by the ([f196293](https://github.com/getappmap/vscode-appland/commit/f19629305bd29e4a56e69741fbd4b3cc9af5c988))
* Notify on analysis state changes ([f8af2ae](https://github.com/getappmap/vscode-appland/commit/f8af2ae460144d82c6180b5c5b8f8f5855b0c209))
* Notify on authentication state changes ([041ffad](https://github.com/getappmap/vscode-appland/commit/041ffad651c7157ad0f266194c9b68ac5eb4571e))

## [0.48.5](https://github.com/getappmap/vscode-appland/compare/v0.48.4...v0.48.5) (2022-10-26)


### Bug Fixes

* Don't attempt to emit appmap:create upon initialization ([d4e75fd](https://github.com/getappmap/vscode-appland/commit/d4e75fdcc743e53de0ee7a61e13a9fbd9979e5fb))
* Initialization failures now have an error code ([b96881e](https://github.com/getappmap/vscode-appland/commit/b96881e4037ef51431e4a5f6cf2709854915b687))
* Write appmap.file.size as a string ([2abd9b4](https://github.com/getappmap/vscode-appland/commit/2abd9b4e26c54c68809877615ab122f8b61321f1))

## [0.48.4](https://github.com/getappmap/vscode-appland/compare/v0.48.3...v0.48.4) (2022-10-24)


### Bug Fixes

* Finding counts in the instructions view is consistent ([c339cb9](https://github.com/getappmap/vscode-appland/commit/c339cb9986b251d345f4050bb499a11ed051075d)), closes [#485](https://github.com/getappmap/vscode-appland/issues/485)

## [0.48.3](https://github.com/getappmap/vscode-appland/compare/v0.48.2...v0.48.3) (2022-10-21)


### Bug Fixes

* Improve analysis findings tree view ([43fd620](https://github.com/getappmap/vscode-appland/commit/43fd62009330670ed73dce11f2618d1c64e56610))

## [0.48.2](https://github.com/getappmap/vscode-appland/compare/v0.48.1...v0.48.2) (2022-10-20)


### Bug Fixes

* install button works with pyenv ([725919f](https://github.com/getappmap/vscode-appland/commit/725919f469e3e25fdb8f0161d7054c2903d80b61))

## [0.48.1](https://github.com/getappmap/vscode-appland/compare/v0.48.0...v0.48.1) (2022-10-19)


### Bug Fixes

* Enable record by default instructions for Python ([d853818](https://github.com/getappmap/vscode-appland/commit/d85381876d8302cf8051b253dc33b178f5a9b739))

# [0.48.0](https://github.com/getappmap/vscode-appland/compare/v0.47.0...v0.48.0) (2022-10-18)


### Bug Fixes

* Don't fully analyze the project on every change update ([bc25c2d](https://github.com/getappmap/vscode-appland/commit/bc25c2dff6c3c80c8f65078a2e30ab9608351fae))
* Look for poetry.lock over pyproject.toml ([40842c4](https://github.com/getappmap/vscode-appland/commit/40842c4fcc9bd90f1d7e068eb2988d57e8e01edf))
* properly escape paths during installation ([08e5c3b](https://github.com/getappmap/vscode-appland/commit/08e5c3bfa96959ada41586c21a0b8bd5943c27e3))
* Remove duplicate findings from appearing in the workspace ([fa0add8](https://github.com/getappmap/vscode-appland/commit/fa0add8daaf50449092436857ba0d8f0f5ab67ad))


### Features

* Add manual installation instructions for pipenv ([39f959d](https://github.com/getappmap/vscode-appland/commit/39f959dc107a9e908df18e190c279c5d96212aa3))
* Detect dependencies from Pipfiles ([f1f3730](https://github.com/getappmap/vscode-appland/commit/f1f3730651062ac7176dfb3051b7d7d57e39ddc7))

# [0.47.0](https://github.com/getappmap/vscode-appland/compare/v0.46.0...v0.47.0) (2022-10-14)


### Bug Fixes

* Projects compatibility is now scored in an expected manner ([677f0e4](https://github.com/getappmap/vscode-appland/commit/677f0e4778427c3f78a57611a6d02e1148e01ae1))
* Rename "Install AppMap agent" to "Add AppMap to your project" in the instructions list ([f5769fa](https://github.com/getappmap/vscode-appland/commit/f5769fafc559dd25a981d44110dade736960fbbd))


### Features

* Enable runtime analysis after logging in to AppMap ([d6a40a9](https://github.com/getappmap/vscode-appland/commit/d6a40a966050b898e80f18b41de0a0a901c90289))
* The runtime analysis popup has been removed ([e328520](https://github.com/getappmap/vscode-appland/commit/e328520da73d98b6e1d6aea765c8b13d787b9601))

# [0.46.0](https://github.com/getappmap/vscode-appland/compare/v0.45.0...v0.46.0) (2022-10-12)


### Bug Fixes

* Describe sessions by email ([a8a9d53](https://github.com/getappmap/vscode-appland/commit/a8a9d53f27555a1e855d04c3941543d94167af6f))
* Gracefully handle cases where AppMap sessions cannot be retrieved ([1c6cc06](https://github.com/getappmap/vscode-appland/commit/1c6cc0615121dc18208181da96d6600e72deb660))


### Features

* Add an alternate authentication mechanism ([1035dae](https://github.com/getappmap/vscode-appland/commit/1035daebc666e4798a5378d512e6f8da6a58d530))
* Upload an AppMap to AppMap Server ([97c66d3](https://github.com/getappmap/vscode-appland/commit/97c66d34ed4c6a66256a6ab658bf9162a6303095))

# [0.45.0](https://github.com/getappmap/vscode-appland/compare/v0.44.1...v0.45.0) (2022-10-06)


### Bug Fixes

* Fix crash on undefined object ([a0e7c41](https://github.com/getappmap/vscode-appland/commit/a0e7c4140b8ee0df702b6b31d461d5e7e561a998))
* Fix multi-line processing of uptodate output ([ba42826](https://github.com/getappmap/vscode-appland/commit/ba42826633196b0d8619777fd0f9a0c8e8009675))


### Features

* Add command to install appmap agent ([#467](https://github.com/getappmap/vscode-appland/issues/467)) ([b5e0933](https://github.com/getappmap/vscode-appland/commit/b5e0933b0197c6a727e6a6602e10710a3e13ce64))
* Authenticate with AppMap Server ([ac971f3](https://github.com/getappmap/vscode-appland/commit/ac971f36d37719b2024d1af84ad80bcff83fa3fa))
* manage AppMap Server configuration ([f08b5e6](https://github.com/getappmap/vscode-appland/commit/f08b5e6ce6831e1a29b8d1360cc5fd570da3ca3e))

## [0.44.1](https://github.com/getappmap/vscode-appland/compare/v0.44.0...v0.44.1) (2022-09-28)


### Bug Fixes

* Update scanner, appmap CLI dependencies ([09c2d4c](https://github.com/getappmap/vscode-appland/commit/09c2d4ca40acbe07b1be3e30e4e8f87d09eaf692))

# [0.44.0](https://github.com/getappmap/vscode-appland/compare/v0.43.0...v0.44.0) (2022-09-26)


### Features

* Send a telemetry event for AppMap creation ([50c3263](https://github.com/getappmap/vscode-appland/commit/50c32637ea403bad26cf3ee3871b194ae764cb1f)), closes [#458](https://github.com/getappmap/vscode-appland/issues/458)

# [0.43.0](https://github.com/getappmap/vscode-appland/compare/v0.42.0...v0.43.0) (2022-09-21)


### Bug Fixes

* Filter 'uptodate' lines which are empty after trim ([3b38fc1](https://github.com/getappmap/vscode-appland/commit/3b38fc102681b7cd0de22b3f2780fc01e0ec8469))
* Update project properties for installable status ([09c1408](https://github.com/getappmap/vscode-appland/commit/09c1408cdbd9c8950f58889e6e47c5a7df42b93d))


### Features

* add telemetry info from project picker ([9888085](https://github.com/getappmap/vscode-appland/commit/988808578ca74ec66f517c56c1ef35927651bd34))

# [0.42.0](https://github.com/getappmap/vscode-appland/compare/v0.41.2...v0.42.0) (2022-09-20)


### Features

* Apply different sorting to AppMap subtrees ([5f66af7](https://github.com/getappmap/vscode-appland/commit/5f66af76e30bbcee59f0343ead93ed2c7308929f))
* Categorize AppMaps ([fbc46ec](https://github.com/getappmap/vscode-appland/commit/fbc46ec514000fe372dd0279f143b4b9386e673f))

## [0.41.2](https://github.com/getappmap/vscode-appland/compare/v0.41.1...v0.41.2) (2022-09-08)


### Bug Fixes

* Prevent a case where OpenAPI would generate invalid YAML ([f55b440](https://github.com/getappmap/vscode-appland/commit/f55b440ffac6bd0264e5715051554b2396cac0a4))

## [0.41.1](https://github.com/getappmap/vscode-appland/compare/v0.41.0...v0.41.1) (2022-08-27)


### Bug Fixes

* Getting started button with no appmaps now opens instructions ([29dc5a2](https://github.com/getappmap/vscode-appland/commit/29dc5a2ac769d5ab3a2ce0e1f8efce1950fcbb24))
* Remove traces of obsolete appMap.instructionsEnabled config ([eaa1c6b](https://github.com/getappmap/vscode-appland/commit/eaa1c6b86697f7d13723f5b5a2317bf8e10db9df))

# [0.41.0](https://github.com/getappmap/vscode-appland/compare/v0.40.0...v0.41.0) (2022-08-26)


### Features

* Keep viewer state when switching tabs ([c46be25](https://github.com/getappmap/vscode-appland/commit/c46be250190ebac3befb350a2be62aa71b622c48))

# [0.40.0](https://github.com/getappmap/vscode-appland/compare/v0.39.2...v0.40.0) (2022-08-19)


### Bug Fixes

* Don't trim the start of log messages ([6b8b94f](https://github.com/getappmap/vscode-appland/commit/6b8b94f12be08a42cb6e1a6dd0df0a94591904e9))


### Features

* Add an instructions page for generating OpenAPI definitions ([4d8e3e9](https://github.com/getappmap/vscode-appland/commit/4d8e3e98aa235fd3e9b3b936443027b794c4a71e))

## [0.39.2](https://github.com/getappmap/vscode-appland/compare/v0.39.1...v0.39.2) (2022-08-01)


### Bug Fixes

* Investigate findings instruction page changed to Runtime Analysis ([d803f70](https://github.com/getappmap/vscode-appland/commit/d803f70347b478adb850f81fe0cc16387829a628))

## [0.39.1](https://github.com/getappmap/vscode-appland/compare/v0.39.0...v0.39.1) (2022-07-31)


### Bug Fixes

* Use glob to find appmap.yml ([3c1c5e7](https://github.com/getappmap/vscode-appland/commit/3c1c5e70e76c9b47dfeda825ee0bb15463f07724))
* Use unlink when deleting AppMaps ([5ad4c11](https://github.com/getappmap/vscode-appland/commit/5ad4c11ce34f5427ba5cb36016a1727ff53bcee1))

# [0.39.0](https://github.com/getappmap/vscode-appland/compare/v0.38.1...v0.39.0) (2022-07-22)


### Features

* Add a URI handler to enable early access ([22e323f](https://github.com/getappmap/vscode-appland/commit/22e323fee05cf1028767aad657f2ccabec0b1eff))
* investigate findings shows signup info when findings not enabled ([18017d5](https://github.com/getappmap/vscode-appland/commit/18017d5f01dff2d94f4236333e3b1d4c8d6b486a))
* send findings domain counts to frontend webview ([2d085e4](https://github.com/getappmap/vscode-appland/commit/2d085e41520eef7a0f6f709ad330705033d96771))

## [0.38.1](https://github.com/getappmap/vscode-appland/compare/v0.38.0...v0.38.1) (2022-07-21)


### Bug Fixes

* Disable the 'next' button on the last instructions page ([bf40a8d](https://github.com/getappmap/vscode-appland/commit/bf40a8d73229ce57b6f33db67783e917495d3534))

# [0.38.0](https://github.com/getappmap/vscode-appland/compare/v0.37.0...v0.38.0) (2022-07-20)


### Features

* send selected code objects to frontend ([dd05e62](https://github.com/getappmap/vscode-appland/commit/dd05e625296d31d726a057f3f99342045b5f4731))

# [0.37.0](https://github.com/getappmap/vscode-appland/compare/v0.36.0...v0.37.0) (2022-07-14)


### Features

* CTA is conditional on extension version ([3d0c76a](https://github.com/getappmap/vscode-appland/commit/3d0c76a4cef35fcb7759b182ab137cfd502c2aae))

# [0.36.0](https://github.com/getappmap/vscode-appland/compare/v0.35.0...v0.36.0) (2022-07-13)


### Bug Fixes

* Debounce metadata and CTA events ([c40cab7](https://github.com/getappmap/vscode-appland/commit/c40cab7b4aa48621f2d9fe659aebc28d90dc1254))
* Don't mark a project bad ([83528b7](https://github.com/getappmap/vscode-appland/commit/83528b7577799a7beb77eee3cd32abf4f674a214))
* Handle exception in the proper place ([168ef11](https://github.com/getappmap/vscode-appland/commit/168ef115d4ebad52177543fe4f46ee9c6674b3c9))
* Remove CONTEXT_FLAG_BETA_ACCESS ([84ec593](https://github.com/getappmap/vscode-appland/commit/84ec59382e5804467fba8485eae777d3cabab351))


### Features

* Change CTA prompt text and action ([dbbec52](https://github.com/getappmap/vscode-appland/commit/dbbec52a8580147fad09f6b785d3a2e169842320))
* Findings view is always visible ([3358e10](https://github.com/getappmap/vscode-appland/commit/3358e1035e4abb1ef9fe10c1fc2c51857c150f12))
* Remove test framework as a CTA criterion ([dce14e3](https://github.com/getappmap/vscode-appland/commit/dce14e3afe82321716653fbef776f38832d1df82))
* Stop popups after user follows CTA ([f52e8fa](https://github.com/getappmap/vscode-appland/commit/f52e8faef832bdf2ce0df7d855d6cc76b7dde1e5))
* Update the findings view info text ([7b35f91](https://github.com/getappmap/vscode-appland/commit/7b35f9167e96582be2d17b00143de9894a66f5e3))

# [0.35.0](https://github.com/getappmap/vscode-appland/compare/v0.34.1...v0.35.0) (2022-07-12)


### Features

* Update the marketplace readme ([19e8aac](https://github.com/getappmap/vscode-appland/commit/19e8aac6b04f30d8adc76c2d3f83cd40332079b7))

## [0.34.1](https://github.com/getappmap/vscode-appland/compare/v0.34.0...v0.34.1) (2022-07-12)


### Bug Fixes

* green check appears upon investigating findings ([#433](https://github.com/getappmap/vscode-appland/issues/433)) ([2484487](https://github.com/getappmap/vscode-appland/commit/2484487956b2ff537ad4016b1fd77b5184556f84))

# [0.34.0](https://github.com/getappmap/vscode-appland/compare/v0.33.0...v0.34.0) (2022-07-06)


### Features

* Default view configuration setting ([ee17599](https://github.com/getappmap/vscode-appland/commit/ee175991f042adaa4612b672cdc6f51ea496d606))

# [0.33.0](https://github.com/getappmap/vscode-appland/compare/v0.32.3...v0.33.0) (2022-07-01)


### Bug Fixes

* Add debug information for instructions steps ([3eeb794](https://github.com/getappmap/vscode-appland/commit/3eeb7941f40444633a674da55bb469a3a482f5bf))
* Tolerate partial node version in .nvmrc ([9620a24](https://github.com/getappmap/vscode-appland/commit/9620a24003d26b5071325229c1eae9c2bda21a4f))


### Features

* Add runtime analysis early access prompts for eligible projects ([f95a375](https://github.com/getappmap/vscode-appland/commit/f95a375206d8a1553655b3e3a13ced6c93a3a00c))
* Release automatic indexing and updated instructions ([70ff951](https://github.com/getappmap/vscode-appland/commit/70ff951fc39981a5b716b48d31fb82b9a72d3323))

## [0.32.3](https://github.com/getappmap/vscode-appland/compare/v0.32.2...v0.32.3) (2022-06-30)


### Bug Fixes

* send node status to frontend ([5fac197](https://github.com/getappmap/vscode-appland/commit/5fac197ca934f8ed9e53212fabbaa04442fdc0e6))

## [0.32.2](https://github.com/getappmap/vscode-appland/compare/v0.32.1...v0.32.2) (2022-06-30)


### Bug Fixes

* remove python feature flag ([1d8d36e](https://github.com/getappmap/vscode-appland/commit/1d8d36e92b9f67f876001276a17556b68164c294))
* tweaked wording when no Gemfile is detected ([b2f1737](https://github.com/getappmap/vscode-appland/commit/b2f17376cc30a87549798ccff1206eb7f153481d))
* update flask scoring and messaging ([a009b83](https://github.com/getappmap/vscode-appland/commit/a009b83e8efee6e86bb8c976e61d73fe131291b5))
* update Ruby analyzer language ([db432fd](https://github.com/getappmap/vscode-appland/commit/db432fd1b81aa89da18429059ddee263b32df529))
* updated JS messages ([4c701e8](https://github.com/getappmap/vscode-appland/commit/4c701e8fdeb169553e1712c43b968b5fa6ebb4b9))
* updated language for java ([bac15da](https://github.com/getappmap/vscode-appland/commit/bac15da7c8c522f47523765602ed078ef6cf071b))
* updated language when express is found ([e975d91](https://github.com/getappmap/vscode-appland/commit/e975d913dc303b205672ff37dabb69f37755d33a))
* updated python messages ([63a7518](https://github.com/getappmap/vscode-appland/commit/63a7518d29d42ef408b2f749eec4722905a68c0e))

## [0.32.1](https://github.com/getappmap/vscode-appland/compare/v0.32.0...v0.32.1) (2022-06-30)


### Bug Fixes

* Fix fqid conflicts in the Code Objects view ([6358d7a](https://github.com/getappmap/vscode-appland/commit/6358d7a09dc53350f88f8b0a3b33e62cf3327840))
* Set exitCode instead of calling exit ([bc4be1c](https://github.com/getappmap/vscode-appland/commit/bc4be1c93367fd946d08d957f6623810c1a3cc95))

# [0.32.0](https://github.com/getappmap/vscode-appland/compare/v0.31.4...v0.32.0) (2022-06-30)


### Bug Fixes

* Add version constraint for @appland/models ([e223ce0](https://github.com/getappmap/vscode-appland/commit/e223ce096fd2b0740bcd4051bd87052e06013ee6))
* Remove duplicate titles from some findings ([d47f541](https://github.com/getappmap/vscode-appland/commit/d47f54142bf4c89342418900831f37880776be3a))
* Run only one uptodate process at a time ([00b8ec0](https://github.com/getappmap/vscode-appland/commit/00b8ec019e36629cc748d111bcbe5f5dd454c2a7))


### Features

* Configurable index/scan/depends commands have been removed ([52135ff](https://github.com/getappmap/vscode-appland/commit/52135ff5908b51c2bd2419829383e302b0dce3f8))
* Run background node processes with Electron node ([dcf90a1](https://github.com/getappmap/vscode-appland/commit/dcf90a1b0e42867baef4aa84bbd49604cc9c43e9))
* Uptodate service now runs via Electron node ([8f91058](https://github.com/getappmap/vscode-appland/commit/8f91058d558340c4b57f717398f6565df92cfff1))

## [0.31.4](https://github.com/getappmap/vscode-appland/compare/v0.31.3...v0.31.4) (2022-06-29)


### Bug Fixes

* update project picker scoring ([b2ff073](https://github.com/getappmap/vscode-appland/commit/b2ff073feb65b6a903c7f7df43877035d3beb802))

## [0.31.3](https://github.com/getappmap/vscode-appland/compare/v0.31.2...v0.31.3) (2022-06-29)


### Bug Fixes

* Create getTreeName function to format tree name ([a643b78](https://github.com/getappmap/vscode-appland/commit/a643b78041e8b6d570bd2d995b01e594b8d53059))

## [0.31.2](https://github.com/getappmap/vscode-appland/compare/v0.31.1...v0.31.2) (2022-06-28)


### Bug Fixes

* Allow opening AppMaps larger than 50 MiB ([2aad9ca](https://github.com/getappmap/vscode-appland/commit/2aad9cae9ec7dbd2f55e255489c115b546fdbbad))
* More robust workspace folder path matching ([5193989](https://github.com/getappmap/vscode-appland/commit/5193989e28c9bb7d68ae5813826ca13b04457278))

## [0.31.1](https://github.com/getappmap/vscode-appland/compare/v0.31.0...v0.31.1) (2022-06-27)


### Bug Fixes

* Update @appland/components v2.5.0 ([7f87ddb](https://github.com/getappmap/vscode-appland/commit/7f87ddb4b3b2f4e73bf7a17467539f0c5c530cb7))
* Updated instructions will appear upon a new installation if flagged ([#398](https://github.com/getappmap/vscode-appland/issues/398)) ([bc72eff](https://github.com/getappmap/vscode-appland/commit/bc72eff2eb9d2ccec458a6f7dea7c56ec8140a46))

# [0.31.0](https://github.com/getappmap/vscode-appland/compare/v0.30.0...v0.31.0) (2022-06-22)


### Bug Fixes

* Anticipate partially written findings files ([fd53351](https://github.com/getappmap/vscode-appland/commit/fd5335160e3b80831fef3d76046f8c645a901fd5))
* Don't reset dirty flag too early ([be80cf4](https://github.com/getappmap/vscode-appland/commit/be80cf4eddfa81cdd7923260283f2b34bb14ba58))
* Don't update uptodate more than necessary ([595970d](https://github.com/getappmap/vscode-appland/commit/595970d51b1d45b6bec606bccd5f216d35b8db85))
* Filter out un-rooted code objects ([a2c30ed](https://github.com/getappmap/vscode-appland/commit/a2c30ed79a3588025ae309f8317a643d517180a3))
* Leverage built-in search to find .gitignore files ([2e8f930](https://github.com/getappmap/vscode-appland/commit/2e8f930cbedf39dc0fec54e8c7a9fc0a5b385cc5))
* Make AppMap index test more robust ([c8245be](https://github.com/getappmap/vscode-appland/commit/c8245beebd273732570cb459ed9dfdb952c306c7))
* Move classMap update to background job ([6f5fec7](https://github.com/getappmap/vscode-appland/commit/6f5fec70065e55efd74c617faa3b8694de135834))
* Only resolve languages every 60 seconds ([c97a598](https://github.com/getappmap/vscode-appland/commit/c97a5980132d8c00f3ed2eff774ad8657f6a347f))
* Respect user's Find Exclude settings ([a675d57](https://github.com/getappmap/vscode-appland/commit/a675d57dfd26f22d179ce1ba2d0f348898e3b7df))
* Sort code object children ([03fd15c](https://github.com/getappmap/vscode-appland/commit/03fd15c06449e77097029d1f3cb98978a886eedf))
* Sort findings by description ([462a170](https://github.com/getappmap/vscode-appland/commit/462a17096fd14ed80d3c88f954b0a44615cd2358))
* Suppress harmless depends errors ([296e9d2](https://github.com/getappmap/vscode-appland/commit/296e9d2b2d08079e4d29cf63c6c2bc7f97f9b175))
* Try harder to resolve file paths within monorepos ([0cd8f7b](https://github.com/getappmap/vscode-appland/commit/0cd8f7be746784bc7f2664ca45246d79820c00fc))
* Update base-dir and appmap-dir options ([2bbc255](https://github.com/getappmap/vscode-appland/commit/2bbc255261a9382fe5158e545af92838590e3a06))


### Features

* Add dependsCommand setting ([4735e15](https://github.com/getappmap/vscode-appland/commit/4735e15aa8f6bf10950a10f8118d157377bfdf84))
* Batch up expensive background jobs ([c076ae5](https://github.com/getappmap/vscode-appland/commit/c076ae594d39e0960e02b97bf123bfae6df2f65a))
* Selectively update up-to-date ([5868fcf](https://github.com/getappmap/vscode-appland/commit/5868fcfdf6c23da94e05d11ddecb1117ca4db390))
* WorkspaceServices is a singleton ([eab066c](https://github.com/getappmap/vscode-appland/commit/eab066cf5fb1764b1899e2aa6aeb5ecc8ad969d7))

# [0.30.0](https://github.com/getappmap/vscode-appland/compare/v0.29.1...v0.30.0) (2022-06-21)


### Bug Fixes

* Remove Flask and Django from README.md ([ea86aec](https://github.com/getappmap/vscode-appland/commit/ea86aecb47fe61348875409d61f421f75773cc95))


### Features

* Put Python support behind a feature flag ([f611a6d](https://github.com/getappmap/vscode-appland/commit/f611a6d9a7d4bf71bfccd3630d1a46a33b353011))

## [0.29.1](https://github.com/getappmap/vscode-appland/compare/v0.29.0...v0.29.1) (2022-06-18)


### Bug Fixes

* AppMap welcome button interaction is now feature flagged ([#395](https://github.com/getappmap/vscode-appland/issues/395)) ([b5f849d](https://github.com/getappmap/vscode-appland/commit/b5f849df93cbf778a760f502f58159622f470ed9))

# [0.29.0](https://github.com/getappmap/vscode-appland/compare/v0.28.3...v0.29.0) (2022-06-17)


### Features

* AppMap terminal link provider ([e697328](https://github.com/getappmap/vscode-appland/commit/e6973283d4510f024f1bbb6224df1d32291d4dcc))

## [0.28.3](https://github.com/getappmap/vscode-appland/compare/v0.28.2...v0.28.3) (2022-06-14)


### Bug Fixes

* `Open AppMaps` instructions view now automatically reloads ([09defe1](https://github.com/getappmap/vscode-appland/commit/09defe125833a384d89aa8020a352581d213d6ca))
* AppMap install state is synchronized at startup ([261f52c](https://github.com/getappmap/vscode-appland/commit/261f52c57f3b6c44710c42946d38d130d787f3f2))
* Clean up resources when closing the instructions window ([2a14ce1](https://github.com/getappmap/vscode-appland/commit/2a14ce13f64ab75ee72d857de97e65f175718dc4))

## [0.28.2](https://github.com/getappmap/vscode-appland/compare/v0.28.1...v0.28.2) (2022-06-09)


### Bug Fixes

* Be more robust to AppMap index temp files ([e32978a](https://github.com/getappmap/vscode-appland/commit/e32978aabd68689a4864489b2dce146e91f71169))
* Filter out blank source locations ([3edb0b7](https://github.com/getappmap/vscode-appland/commit/3edb0b73e99ab397b9d9df2264431a336026c337))
* Handle code object not found ([247f6c3](https://github.com/getappmap/vscode-appland/commit/247f6c3174d9c65ea079d9a799636f2bfb581ea2))

## [0.28.1](https://github.com/getappmap/vscode-appland/compare/v0.28.0...v0.28.1) (2022-06-06)


### Bug Fixes

* Update README ([25d0c46](https://github.com/getappmap/vscode-appland/commit/25d0c467528cd804aa187bffc9c3bbed5bb814f6))

# [0.28.0](https://github.com/getappmap/vscode-appland/compare/v0.27.0...v0.28.0) (2022-06-06)


### Features

* Commands appmap.view.* ([acfab07](https://github.com/getappmap/vscode-appland/commit/acfab07e8c4f7a69f7c7ef64e10ea610c64eaa5c))
* Indicate whether AppMaps are up-to-date ([0213cb6](https://github.com/getappmap/vscode-appland/commit/0213cb66403741b0712de71f3a135d6fb16f8a3e))
* out-of-date tests ([9d27b53](https://github.com/getappmap/vscode-appland/commit/9d27b53dca956e3959c49bf9ecacfc4116ba8d41))
* Print out of date test names to the clipboard ([57a29a1](https://github.com/getappmap/vscode-appland/commit/57a29a1bd1e28185ef98373d392d4212accffccf))

# [0.27.0](https://github.com/getappmap/vscode-appland/compare/v0.26.2...v0.27.0) (2022-06-02)


### Bug Fixes

* Experimental instructions are toggled behind a feature flag ([fd95295](https://github.com/getappmap/vscode-appland/commit/fd95295d6f8dda60ce7e7b0908a71620428e1a6c))
* Fix language resolver test ([533424a](https://github.com/getappmap/vscode-appland/commit/533424af5346b4b1ce8d60db5e86dd720bb0aece))
* Fix scanner test ([2997978](https://github.com/getappmap/vscode-appland/commit/29979783e5f4a4e21fe484b2d2990424f15be58f))
* Line info depends on code objects only ([bfd8b92](https://github.com/getappmap/vscode-appland/commit/bfd8b925e9b57a1459f8e206cd598c71ad6f4315))
* Suppress directory removal warning ([6239ed6](https://github.com/getappmap/vscode-appland/commit/6239ed614891d69e210fce3c056a40a58855c504))


### Features

* Add 'Open AppMaps' to updated instructions ([6682c68](https://github.com/getappmap/vscode-appland/commit/6682c68d0fe2768e4f9a05f9d298ad619730386e))
* Add indexEnabled flag ([4736138](https://github.com/getappmap/vscode-appland/commit/4736138eee2ea818973905532157c1e6a9eb1068))
* AppMap usage guide ([2d7f48b](https://github.com/getappmap/vscode-appland/commit/2d7f48b7760b4142d044d1efd74f12701870a5b2))

## [0.26.2](https://github.com/getappmap/vscode-appland/compare/v0.26.1...v0.26.2) (2022-05-31)


### Bug Fixes

* Migrate Discord to Slack ([a5f6475](https://github.com/getappmap/vscode-appland/commit/a5f6475df0083405e8f69d9e31a6bc29332fbe8b))

## [0.26.1](https://github.com/getappmap/vscode-appland/compare/v0.26.0...v0.26.1) (2022-05-26)


### Bug Fixes

* Update @appland/components ([adac18b](https://github.com/getappmap/vscode-appland/commit/adac18b1ba33174fe9348e842cc5dbf0a1dfe4a9))

# [0.26.0](https://github.com/getappmap/vscode-appland/compare/v0.25.1...v0.26.0) (2022-05-24)


### Bug Fixes

* Absolute file paths don't decorate ([a068b40](https://github.com/getappmap/vscode-appland/commit/a068b40e56187db2303c7e69beac62959d2a17a4))
* Add ~/.yarn/bin to path ([009b512](https://github.com/getappmap/vscode-appland/commit/009b512f4ab179f1bbd5c2c107112a66857b0bfc))
* Add missing openapi-types ([959cc4d](https://github.com/getappmap/vscode-appland/commit/959cc4de4d2c46d154ed2e1485b32827d2657973))
* Add some Disposable subscriptions ([caeedbe](https://github.com/getappmap/vscode-appland/commit/caeedbe32680ce23181716249fc597734152dde9))
* autoIndexer|Scanner returns process Promise ([936207c](https://github.com/getappmap/vscode-appland/commit/936207c5649dc28288a2bbbdf1e2e78d379c35bc))
* Decorations show on initial editor ([54bd374](https://github.com/getappmap/vscode-appland/commit/54bd3743a05c351fcf24c0f3a654afc36e96275a))
* Fix casing in file name ([c18122e](https://github.com/getappmap/vscode-appland/commit/c18122e21d5ee8edfcc23cea01d8be34a2fd98e9))
* Fixups to rebase ([bd6a247](https://github.com/getappmap/vscode-appland/commit/bd6a247dc52f98c50663f7eb6c3343c438fe6bfa))
* Handle missing findings file ([f418c51](https://github.com/getappmap/vscode-appland/commit/f418c51f3de14ab8fc78d50039974a816ea5b420))
* Hide context menus from the command palette ([fba2a0d](https://github.com/getappmap/vscode-appland/commit/fba2a0db50286f21c1d05f4db46eaa8c924cf87d))
* Increase timeout on process service retry ([e46820a](https://github.com/getappmap/vscode-appland/commit/e46820a62789cdc835a7d94ed53a27f238ab0456))
* Path-delimited package names in the classMap ([c71ef55](https://github.com/getappmap/vscode-appland/commit/c71ef5544e048195ca4d4cec6782027c75ef5c68))
* Remove AppMap count as it's usuall wrong ([ba2b34e](https://github.com/getappmap/vscode-appland/commit/ba2b34ec128e2d4f3cd7c370cb473275bb8b12d7))
* Respond to workspace add/remove events ([564c1be](https://github.com/getappmap/vscode-appland/commit/564c1be907fadcf99b9cf50f6605291aaa662b35))
* Run service command with yarn run or npm exec ([ffee49a](https://github.com/getappmap/vscode-appland/commit/ffee49acbce1491f9738b24319c6df5c5753c5da))
* Search parent folders for npm/yarn lock files ([496b2cf](https://github.com/getappmap/vscode-appland/commit/496b2cf974634dde882f3714a06e61d45c73d707))


### Features

* Add a Code Objects tree view ([27b0d71](https://github.com/getappmap/vscode-appland/commit/27b0d716e3aaeb23e86ae7c17d71156aa4037089))
* Add AppMap 12px icon ([49ee452](https://github.com/getappmap/vscode-appland/commit/49ee452b547e773c1904d8b9e41830721872eeb8))
* Add command appmap.deleteAllAppMaps ([dd0ea7d](https://github.com/getappmap/vscode-appland/commit/dd0ea7d01f5bb68e23924c2926f8ca94faff2860))
* Context menu + click for Code Objects ([a41b05d](https://github.com/getappmap/vscode-appland/commit/a41b05d30eaaa853f30bd958348146d736732782))
* Decoration provider ([d23a0a7](https://github.com/getappmap/vscode-appland/commit/d23a0a70082cec0e37ebdb7954791c833f5b2435))
* Export extension interfaces ([70bbe69](https://github.com/getappmap/vscode-appland/commit/70bbe690ad0ba80a07f058a6c0d29ac3bdf08d97))
* Extend CodeObjectEntry fields ([2dc839e](https://github.com/getappmap/vscode-appland/commit/2dc839e71ebac9be74dc5305d9356616661d74ba))
* Feature flag for 'inspect' CLI command ([b4a7532](https://github.com/getappmap/vscode-appland/commit/b4a75328ce77afe056c3ecaa33214b2da0dfcf7f))
* Hover provider ([2b089e9](https://github.com/getappmap/vscode-appland/commit/2b089e90e924822c2a6cea1f554afc20c9fed142))
* Inspect code object via CLI shell-out ([16b45eb](https://github.com/getappmap/vscode-appland/commit/16b45ebc5b27b48bcfa61a892569270f1560cd87))
* Inspect hover shows links to ancestors ([34773c9](https://github.com/getappmap/vscode-appland/commit/34773c9c83e01f92e67e3b17a2cfdfac962c99d2))
* Line-index, hover, decoration provider ([e72de09](https://github.com/getappmap/vscode-appland/commit/e72de09f7a35aa4658523b8a6b7eb93e4e33ba5f))
* LineInfoIndex ([875c696](https://github.com/getappmap/vscode-appland/commit/875c6968925065859f56a84063e008753a4ce6e4))
* Open AppMaps from code object tree ([981bd58](https://github.com/getappmap/vscode-appland/commit/981bd58030eea677527926de628726f6e422b210))
* Open code object in AppMap ([d0c4751](https://github.com/getappmap/vscode-appland/commit/d0c4751f3da87ea2ae8f26c860ed40cc31663778))
* Simplify hover ([7bfccf1](https://github.com/getappmap/vscode-appland/commit/7bfccf13e2ce102b1a1e84254675d9cefac26104))

## [0.25.1](https://github.com/getappmap/vscode-appland/compare/v0.25.0...v0.25.1) (2022-05-24)


### Bug Fixes

* Process service now inherits user environment ([021b777](https://github.com/getappmap/vscode-appland/commit/021b777f6e86316ac87a19a84d76d2a6257579d2))

# [0.25.0](https://github.com/getappmap/vscode-appland/compare/v0.24.2...v0.25.0) (2022-05-15)


### Bug Fixes

* Fix command titles ([3a33841](https://github.com/getappmap/vscode-appland/commit/3a3384179d971a32aa50a79ca1b7778a7e21398d))
* Number.MAX_VALUE shows marker to end-of-line ([b60bef7](https://github.com/getappmap/vscode-appland/commit/b60bef775a457cf0e42c86ddf877057385dab2b8))
* Try re-adding launch args ([3b85580](https://github.com/getappmap/vscode-appland/commit/3b85580738a1102c0673fa33e9d6ed06dee41249))


### Features

* Enable/disable findings via setting ([48bee0a](https://github.com/getappmap/vscode-appland/commit/48bee0a0a4ca852be6efbf206b7fd96494499f8b))
* Identify and display Findings ([b622eaa](https://github.com/getappmap/vscode-appland/commit/b622eaab9130accbe09d005eab76d3a86040ec75))
* Index and scan AppMaps continuously ([85852f4](https://github.com/getappmap/vscode-appland/commit/85852f4b497d77b33a0a162907cfd99bde40b6c6))
* Make sure child processes are not detached ([02d1d57](https://github.com/getappmap/vscode-appland/commit/02d1d579d196e4e50c4e98bb9a01b5dc7f0b0812))
* Show error message when a dependent process can't be spawned ([a78f7d5](https://github.com/getappmap/vscode-appland/commit/a78f7d5ee0ce3fd8839d606e6246fa8e99482f72))
* Verify project Node.js version ([70b6986](https://github.com/getappmap/vscode-appland/commit/70b698637ef3e93945ba1792393a803d4230e0b2))
* Wait for child processes to terminate ([88c8792](https://github.com/getappmap/vscode-appland/commit/88c879211d3668511588799191e51fa422bc6e0d))

## [0.24.2](https://github.com/getappmap/vscode-appland/compare/v0.24.1...v0.24.2) (2022-05-13)


### Bug Fixes

* Non-root level gitignores will no longer be treated as root ([112998d](https://github.com/getappmap/vscode-appland/commit/112998d90ef51e9f8dd93b14a339d44f385dc79c))

## [0.24.1](https://github.com/getappmap/vscode-appland/compare/v0.24.0...v0.24.1) (2022-05-09)


### Bug Fixes

* Remove project watcher, milestones and quickstart ([ef2b135](https://github.com/getappmap/vscode-appland/commit/ef2b135d0023c1604d0864477cbc5977c7dda282))

# [0.24.0](https://github.com/getappmap/vscode-appland/compare/v0.23.6...v0.24.0) (2022-05-04)


### Features

* Ensure the editor is configured to watch AppMaps ([a7e3aa5](https://github.com/getappmap/vscode-appland/commit/a7e3aa5b1469f82d7eeea9d882b98c578fda58fb))

## [0.23.6](https://github.com/getappmap/vscode-appland/compare/v0.23.5...v0.23.6) (2022-05-04)


### Bug Fixes

* AppMap count responds to project add/remove ([eb50ac1](https://github.com/getappmap/vscode-appland/commit/eb50ac12b640668d849f84dafd61d98a9247a74c))
* Fix appmap.findByName ([9065f32](https://github.com/getappmap/vscode-appland/commit/9065f32413128262e2fe59bc367964d81eeb1e3d))
* Remove broken doc links ([e2f1364](https://github.com/getappmap/vscode-appland/commit/e2f136490d2aebfd2471c150d27f4a363fcc7efb))

## [0.23.5](https://github.com/getappmap/vscode-appland/compare/v0.23.4...v0.23.5) (2022-02-12)


### Bug Fixes

* Update dependencies ([cb0e9b0](https://github.com/getappmap/vscode-appland/commit/cb0e9b054024776e89c937bd4261dc4ecfe2ad8b))

## [0.23.4](https://github.com/getappmap/vscode-appland/compare/v0.23.3...v0.23.4) (2022-02-10)


### Bug Fixes

* Clarify installation instructions ([#371](https://github.com/getappmap/vscode-appland/issues/371)) ([19c15ca](https://github.com/getappmap/vscode-appland/commit/19c15ca8b0ec08ed5075db9489de08fdcc19948b))

## [0.23.3](https://github.com/getappmap/vscode-appland/compare/v0.23.2...v0.23.3) (2022-02-08)


### Bug Fixes

* Upgrade @appland/components to v1.23.0 ([5e99a48](https://github.com/getappmap/vscode-appland/commit/5e99a481f2572fb8c968d86f9f47758f0dc6f149))

## [0.23.2](https://github.com/getappmap/vscode-appland/compare/v0.23.1...v0.23.2) (2022-01-13)


### Bug Fixes

* Update README ([aa09ba4](https://github.com/getappmap/vscode-appland/commit/aa09ba41eb577c70ce264bc3346757bfc917ce4f))

## [0.23.1](https://github.com/getappmap/vscode-appland/compare/v0.23.0...v0.23.1) (2022-01-12)


### Bug Fixes

* Document availability of AppMap for JavaScript ([#370](https://github.com/getappmap/vscode-appland/issues/370)) ([591b8f0](https://github.com/getappmap/vscode-appland/commit/591b8f012a1824193e3c1dc97bf01ca88087d0cc))

# [0.23.0](https://github.com/getappmap/vscode-appland/compare/v0.22.4...v0.23.0) (2021-12-02)


### Features

* JavaScript support in the project picker ([5b7e648](https://github.com/getappmap/vscode-appland/commit/5b7e64811362032593c25d84a5068145d8cdfa80)), closes [#366](https://github.com/getappmap/vscode-appland/issues/366)

## [0.22.4](https://github.com/getappmap/vscode-appland/compare/v0.22.3...v0.22.4) (2021-11-08)


### Bug Fixes

* Don't attempt to index undefined when no languages are available ([4a6c2de](https://github.com/getappmap/vscode-appland/commit/4a6c2dea6c83262ba46c2576a2f3bd7f3eb99fae))

## [0.22.3](https://github.com/getappmap/vscode-appland/compare/v0.22.2...v0.22.3) (2021-11-05)


### Bug Fixes

* More robust language detection in project overview ([6313233](https://github.com/getappmap/vscode-appland/commit/63132334d0cb83fd3195017068e31373fadeba9a))

## [0.22.2](https://github.com/getappmap/vscode-appland/compare/v0.22.1...v0.22.2) (2021-11-02)


### Bug Fixes

* Send telemetry event on manual command copy ([4fad9d2](https://github.com/getappmap/vscode-appland/commit/4fad9d2edaaeba8c8420df725319db3c667d54fc))

## [0.22.1](https://github.com/getappmap/vscode-appland/compare/v0.22.0...v0.22.1) (2021-10-28)


### Bug Fixes

* Quote paths with spaces in "getting started" ([61612ad](https://github.com/getappmap/vscode-appland/commit/61612ad9fc9311984a487346c3ff88ef22ab4421))

# [0.22.0](https://github.com/getappmap/vscode-appland/compare/v0.21.6...v0.22.0) (2021-10-28)


### Features

* Replace quickstart screens with project picker ([73ab5ac](https://github.com/getappmap/vscode-appland/commit/73ab5ac4615a8ddd2a206fa074ae7475ad06eb3c))

## [0.21.6](https://github.com/getappmap/vscode-appland/compare/v0.21.5...v0.21.6) (2021-10-25)


### Bug Fixes

* Update extension description in README ([#359](https://github.com/getappmap/vscode-appland/issues/359)) ([00a2270](https://github.com/getappmap/vscode-appland/commit/00a22703262bbf02336aef8042461d9fa303ce28))

## [0.21.5](https://github.com/getappmap/vscode-appland/compare/v0.21.4...v0.21.5) (2021-10-21)


### Bug Fixes

* Add the project path to the installer command ([#356](https://github.com/getappmap/vscode-appland/issues/356)) ([69de4b9](https://github.com/getappmap/vscode-appland/commit/69de4b9ba96e7c562897dd4a97d4afa8c9dfba34))

## [0.21.4](https://github.com/getappmap/vscode-appland/compare/v0.21.3...v0.21.4) (2021-10-08)


### Bug Fixes

* Ignore file access errors where possible ([8b7ac90](https://github.com/getappmap/vscode-appland/commit/8b7ac9020a01a89bb1c12ff8f1017bd1aaed6a67))

## [0.21.3](https://github.com/getappmap/vscode-appland/compare/v0.21.2...v0.21.3) (2021-10-05)


### Bug Fixes

* Update social media section in README ([#355](https://github.com/getappmap/vscode-appland/issues/355)) ([74049c0](https://github.com/getappmap/vscode-appland/commit/74049c00752f9dcc65bc0dd101964dada41132bd))

## [0.21.2](https://github.com/getappmap/vscode-appland/compare/v0.21.1...v0.21.2) (2021-10-04)


### Bug Fixes

* Update Marketplace description ([a22ca47](https://github.com/getappmap/vscode-appland/commit/a22ca47ff077a22f2a6303411f2a587d9b41f263))

## [0.21.1](https://github.com/getappmap/vscode-appland/compare/v0.21.0...v0.21.1) (2021-09-24)


### Bug Fixes

* Capture debug information on number of workspace folders ([ede0c1c](https://github.com/getappmap/vscode-appland/commit/ede0c1caf48a2aca1830672a0ecaf966114043f1))

# [0.21.0](https://github.com/getappmap/vscode-appland/compare/v0.20.0...v0.21.0) (2021-09-22)


### Features

* Load AppMaps from a URI ([#232](https://github.com/getappmap/vscode-appland/issues/232)) ([2d38e4e](https://github.com/getappmap/vscode-appland/commit/2d38e4e30c3686836ae24e540e92cb3f7ad5cb8c))

# [0.20.0](https://github.com/getappmap/vscode-appland/compare/v0.19.0...v0.20.0) (2021-09-21)


### Bug Fixes

* Disable uploading AppMaps from within the app ([3fb2d4e](https://github.com/getappmap/vscode-appland/commit/3fb2d4ef0389c420814ed5fcf4fa5e1fcae33268))
* Upgrade @appland/components to v1.12.2 ([e8d6bba](https://github.com/getappmap/vscode-appland/commit/e8d6bbaa470d3d0f1d27222abf03709cc18fa564))


### Features

* Welcome and install views have merged ([1644d43](https://github.com/getappmap/vscode-appland/commit/1644d43dabe9cfdffce351e70b7779e224e69b5e))

# [0.19.0](https://github.com/getappmap/vscode-appland/compare/v0.18.1...v0.19.0) (2021-09-17)


### Features

* Show progress notification when remote recording is in progress ([#350](https://github.com/getappmap/vscode-appland/issues/350)) ([9854030](https://github.com/getappmap/vscode-appland/commit/98540303ed0642f8b87323623af2393b80833e8d))

## [0.18.1](https://github.com/getappmap/vscode-appland/compare/v0.18.0...v0.18.1) (2021-09-15)


### Bug Fixes

* Update README ([f3e1ee0](https://github.com/getappmap/vscode-appland/commit/f3e1ee07a02cb6f9f8ded7ed2d28b8a7576cb32a))

# [0.18.0](https://github.com/getappmap/vscode-appland/compare/v0.17.2...v0.18.0) (2021-09-07)


### Bug Fixes

* Better support for `.gitignore` while identifying project language ([#334](https://github.com/getappmap/vscode-appland/issues/334)) ([92d175d](https://github.com/getappmap/vscode-appland/commit/92d175d32b814edaaff7908c3a4a6a3bb57d1053))


### Features

* Add additional telemetry events ([#328](https://github.com/getappmap/vscode-appland/issues/328)) ([21a8839](https://github.com/getappmap/vscode-appland/commit/21a883952de42a86f9ac943c53e8c510d7584ab8))
* Add CLI installer flow ([#325](https://github.com/getappmap/vscode-appland/issues/325)) ([882767f](https://github.com/getappmap/vscode-appland/commit/882767f696299a936d3e332813bfa30961282844))
* Add context menu to AppMap panel ([#344](https://github.com/getappmap/vscode-appland/issues/344)) ([14492c5](https://github.com/getappmap/vscode-appland/commit/14492c5080ade2a67042e814ceafebc847bc2727))

## [0.17.2](https://github.com/getappmap/vscode-appland/compare/v0.17.1...v0.17.2) (2021-08-11)


### Bug Fixes

* Do not show instructions popup automatically ([f62a93a](https://github.com/getappmap/vscode-appland/commit/f62a93a5a04cef7bf6ff4ef8e35bba2286b8f7c7))

## [0.17.1](https://github.com/getappmap/vscode-appland/compare/v0.17.0...v0.17.1) (2021-08-10)


### Bug Fixes

* Don't coerce arbitrary types into strings ([53800dc](https://github.com/getappmap/vscode-appland/commit/53800dc30dd6e62700c735d5967b201f7002aa79))

# [0.17.0](https://github.com/getappmap/vscode-appland/compare/v0.16.0...v0.17.0) (2021-08-06)


### Bug Fixes

* Don't open a webview upon initialization ([a44ce5b](https://github.com/getappmap/vscode-appland/commit/a44ce5b81a48a5ff0a0ee547d60b1ed6169ad842))


### Features

* Add the ability to upload AppMaps to AppLand cloud ([#182](https://github.com/getappmap/vscode-appland/issues/182)) ([5b5b35f](https://github.com/getappmap/vscode-appland/commit/5b5b35fd8d1809b6df1f80023142198a655741bc))

# [0.16.0](https://github.com/getappmap/vscode-appland/compare/v0.15.2...v0.16.0) (2021-08-05)


### Features

* Replace `Insatll AppMap agent` button ([7de440a](https://github.com/getappmap/vscode-appland/commit/7de440a19c4fad296aee3a6ed825107ac5f0226b))

## [0.15.2](https://github.com/getappmap/vscode-appland/compare/v0.15.1...v0.15.2) (2021-08-03)


### Bug Fixes

* Alter files included in the extension bundle ([2b765d5](https://github.com/getappmap/vscode-appland/commit/2b765d53e5663770ac78b7225962f34f70804bd0))

## [0.15.1](https://github.com/getappmap/vscode-appland/compare/v0.15.0...v0.15.1) (2021-08-01)


### Bug Fixes

* Abort project polling if one of the ticks fails unexpectedly. ([daeb191](https://github.com/getappmap/vscode-appland/commit/daeb19198929b75ae8fcc2df20e8c90a8ffcad4e))

# [0.15.0](https://github.com/getappmap/vscode-appland/compare/v0.14.4...v0.15.0) (2021-07-30)


### Bug Fixes

* add possible folders with appmaps to file watcher ([a003af6](https://github.com/getappmap/vscode-appland/commit/a003af6e1e8dec196faf1f90ea56bbcbca694df5))
* check recording status when trying to stop not running session ([7163177](https://github.com/getappmap/vscode-appland/commit/7163177041affa2bffb4f9bfb2763dbdd3900f87))
* ensure config contents is available on step 2 for fresh installations ([0743a4a](https://github.com/getappmap/vscode-appland/commit/0743a4a9d2b5fc8ef67c1537ff2d13a2695a056e))
* finish extension initialization when no workspace is open ([e4bd612](https://github.com/getappmap/vscode-appland/commit/e4bd612f1f445ca12a1d80a52c3b7757ee5c084f))
* Only return supported languages when identifying project language ([875856c](https://github.com/getappmap/vscode-appland/commit/875856cee17c9649b465b6c54eb17733a1f85429))
* prevent silent errors when CLI commands are failed ([fb37b8f](https://github.com/getappmap/vscode-appland/commit/fb37b8f5aabe2a938b9c087ba091a33b01aebd25))
* read project.testFrameworks after the `status` information is available ([213cffe](https://github.com/getappmap/vscode-appland/commit/213cffe6831371ddeed6655661494dca1d99fb58))
* real links to docs ([17c2fd3](https://github.com/getappmap/vscode-appland/commit/17c2fd36628bfdf7c8849019ae078a3b04f3e15b))
* set steps 3 and 4 incomplete when steps 1 or 2 are completed ([efec142](https://github.com/getappmap/vscode-appland/commit/efec142e531358dea1e3982ebf5f40622732211c))
* show update notification only when extension was updated ([b8217c4](https://github.com/getappmap/vscode-appland/commit/b8217c4c45b808dc070e961be80c839db008b8ed))


### Features

* add 'Using AppMaps' and 'Mastering AppMaps' sidebar lists ([#253](https://github.com/getappmap/vscode-appland/issues/253)) ([30097fa](https://github.com/getappmap/vscode-appland/commit/30097faf2ba2d106b0278a68c64b8ef5a55cec7f))
* Add Quickstart documentation pages ([#297](https://github.com/getappmap/vscode-appland/issues/297)) ([444dadb](https://github.com/getappmap/vscode-appland/commit/444dadbb8d4d7d65fa324cfb8389da88aa1cf57b))
* Reset saved usage state ([9885b57](https://github.com/getappmap/vscode-appland/commit/9885b5739ae863d1d66fe7f5223063ebb8529634))
* show 'Open Quickstart' button when no appmaps found ([3620dcb](https://github.com/getappmap/vscode-appland/commit/3620dcb17e820662062ea0574ec33e3c7cbc28d1))

## [0.14.4](https://github.com/getappmap/vscode-appland/compare/v0.14.3...v0.14.4) (2021-06-23)


### Bug Fixes

* Upgrade dependencies ([ff05077](https://github.com/getappmap/vscode-appland/commit/ff050778940b5c9bc0b8b959df1230de992e3bf8))
* Upgrade dependencies ([83b21a1](https://github.com/getappmap/vscode-appland/commit/83b21a134f0f2cf3a12b1116b8e88701460935fc))

## [0.14.3](https://github.com/getappmap/vscode-appland/compare/v0.14.2...v0.14.3) (2021-06-16)


### Bug Fixes

* Bundle diagram styling ([e525c2e](https://github.com/getappmap/vscode-appland/commit/e525c2e967c37be6359c2cecdadd192187be7494))

## [0.14.2](https://github.com/getappmap/vscode-appland/compare/v0.14.1...v0.14.2) (2021-06-15)


### Bug Fixes

* Upgrade @appland/components to v1.1.8 ([ec39e09](https://github.com/getappmap/vscode-appland/commit/ec39e099eed1392d75f6e5fef9c95ca9c6aa5615))

## [0.14.1](https://github.com/getappmap/vscode-appland/compare/v0.14.0...v0.14.1) (2021-06-09)


### Bug Fixes

* Upgrade @appland/components to v1.1.6, @appland/models to v1.0.6 ([aab9672](https://github.com/getappmap/vscode-appland/commit/aab96729418cc5bfc6757d66cd7c1ad75d717a9d))

# [0.14.0](https://github.com/getappmap/vscode-appland/compare/v0.13.0...v0.14.0) (2021-06-07)


### Bug Fixes

* Don't rely on isNewAppInstall for new installations ([#202](https://github.com/getappmap/vscode-appland/issues/202)) ([c29aaca](https://github.com/getappmap/vscode-appland/commit/c29aaca4db67cf00d07f38de67d5be011997713f))
* Send event counts as metrics instead of event properties ([#200](https://github.com/getappmap/vscode-appland/issues/200)) ([d521b3a](https://github.com/getappmap/vscode-appland/commit/d521b3a66f3c1e83fa0ee8c6e193039cb06ff533))


### Features

* Add remote recording commands and interface ([#183](https://github.com/getappmap/vscode-appland/issues/183)) ([c5615a7](https://github.com/getappmap/vscode-appland/commit/c5615a7d071ce6548fa3a4b892417824961162bc))

# [0.13.0](https://github.com/getappmap/vscode-appland/compare/v0.12.1...v0.13.0) (2021-05-20)


### Bug Fixes

* Initialize after startup has completed ([5abe7d4](https://github.com/getappmap/vscode-appland/commit/5abe7d4611efd2e8f45e12ac09f25aa21b900370))


### Features

* Report AppMap agent references and project language/framework on initialize ([a11feca](https://github.com/getappmap/vscode-appland/commit/a11feca72db940ca750a3cee5a9ca9078109b463))
* Send telemetry event after extension installation ([8024b63](https://github.com/getappmap/vscode-appland/commit/8024b633749463543ed0bb23fecd4308b77c99a8))
* Send telemetry event upon opening a URL from the AppMap view ([505c87a](https://github.com/getappmap/vscode-appland/commit/505c87a7ae86ee0d2cd5905f267236c6d56cfdfd))

## [0.12.1](https://github.com/getappmap/vscode-appland/compare/v0.12.0...v0.12.1) (2021-04-30)


### Bug Fixes

* The AppMap panel will no longer display AppMaps within node_modules ([e4a5a06](https://github.com/getappmap/vscode-appland/commit/e4a5a0659f6cdc3a01ba7f60be75b559e0749ef4))

# [0.12.0](https://github.com/getappmap/vscode-appland/compare/v0.11.1...v0.12.0) (2021-04-28)


### Features

* Add AppMap to the sidebar ([a650bb7](https://github.com/getappmap/vscode-appland/commit/a650bb7071df0c8b8d5d867d922a514cedfc3322))
* Display patch notes in the AppMap viewer ([323ade6](https://github.com/getappmap/vscode-appland/commit/323ade664781a15e75b77c75465e3645c6153c85))
* filter and search AppMaps ([91a8f5e](https://github.com/getappmap/vscode-appland/commit/91a8f5e593018c0c8944f8dd49758d0d42e30357))
* update @appland/appmap to v2.3.4 ([c8f9ace](https://github.com/getappmap/vscode-appland/commit/c8f9ace4288046aafdf80065a04182bbf114fabe))

## [0.11.1](https://github.com/getappmap/vscode-appland/compare/v0.11.0...v0.11.1) (2021-04-22)


### Bug Fixes

* Remove command state subscriptions when initializing new views ([cb1ef33](https://github.com/getappmap/vscode-appland/commit/cb1ef334b9126d2f73b9f0b9a0162395ee194827))

# [0.11.0](https://github.com/getappmap/vscode-appland/compare/v0.10.1...v0.11.0) (2021-04-22)


### Features

* Add commands to read and write AppMap state ([21fd561](https://github.com/getappmap/vscode-appland/commit/21fd561ba50fc262c9fd1cc5658ef61a7010fbb5))
* Upgrade @appland/appmap to v2.2.0 ([b7a7e09](https://github.com/getappmap/vscode-appland/commit/b7a7e09cc378e52ccc7d58b07ff91fb599eeca81))

## [0.10.1](https://github.com/getappmap/vscode-appland/compare/v0.10.0...v0.10.1) (2021-04-07)


### Bug Fixes

* Update instrumentation key ([147a94a](https://github.com/getappmap/vscode-appland/commit/147a94ae9c8d1b56bb76878f256f71bae628d4ee))

# [0.10.0](https://github.com/getappmap/vscode-appland/compare/v0.9.1...v0.10.0) (2021-04-06)


### Bug Fixes

* AppMap instructions are now shown upon first opening the extension ([#164](https://github.com/getappmap/vscode-appland/issues/164)) ([4de99a6](https://github.com/getappmap/vscode-appland/commit/4de99a6793f2b2ae525866d0c63328de8898e85b))
* Upgrade @appland/appmap to v1.12 ([54cd392](https://github.com/getappmap/vscode-appland/commit/54cd392f37bbc67a85551e55a4d534c43a78bed1))


### Features

* Report anonymous usage metadata and webview exceptions ([#167](https://github.com/getappmap/vscode-appland/issues/167)) ([b519176](https://github.com/getappmap/vscode-appland/commit/b519176ecd4c0f34bc7a9806b17d5149d746c191))

## [0.9.1](https://github.com/getappmap/vscode-appland/compare/v0.9.0...v0.9.1) (2021-03-24)


### Bug Fixes

* revert bundled logo ([d9a9e69](https://github.com/getappmap/vscode-appland/commit/d9a9e69f33515377fba947a7acdcc9e187d001e0))

# [0.9.0](https://github.com/getappmap/vscode-appland/compare/v0.8.6...v0.9.0) (2021-03-24)


### Features

* update @appland/appmap to v1.7.0 ([16635b4](https://github.com/getappmap/vscode-appland/commit/16635b442bb2810e3d072b5a4a09df48725ed2a9))

## [0.8.6](https://github.com/getappmap/vscode-appland/compare/v0.8.5...v0.8.6) (2021-03-23)


### Bug Fixes

* doc and video update for recent agent changes ([eaef258](https://github.com/getappmap/vscode-appland/commit/eaef2581ecc1c34c1a9e38409818824acd046efa))

## [0.8.5](https://github.com/getappmap/vscode-appland/compare/v0.8.4...v0.8.5) (2021-03-18)


### Bug Fixes

* adding java video and tutorial to docs ([b6684ed](https://github.com/getappmap/vscode-appland/commit/b6684edaf5de541be5fba2ceda5bf8ba523c4b67))

## [0.8.4](https://github.com/getappmap/vscode-appland/compare/v0.8.3...v0.8.4) (2021-03-11)


### Bug Fixes

* adding support@ email to documentation ([b888dcd](https://github.com/getappmap/vscode-appland/commit/b888dcdd6c8a688b588154a4eb0fa9d1c7b60a8b))

## [0.8.3](https://github.com/getappmap/vscode-appland/compare/v0.8.2...v0.8.3) (2021-03-11)


### Bug Fixes

* sharing instructions, setup videos ([8273f34](https://github.com/getappmap/vscode-appland/commit/8273f343388f50f77b5c53c926fff68b0de0e3ef))

## [0.8.2](https://github.com/getappmap/vscode-appland/compare/v0.8.1...v0.8.2) (2021-03-06)


### Bug Fixes

* updated description and keywords ([3e0a1f3](https://github.com/getappmap/vscode-appland/commit/3e0a1f305d0ba6390be0740e5d672d98c7dea6e2))

## [0.8.1](https://github.com/getappmap/vscode-appland/compare/v0.8.0...v0.8.1) (2021-03-05)


### Bug Fixes

* update docs for positioning, arrow keys in trace ([#146](https://github.com/getappmap/vscode-appland/issues/146)) ([cb7e690](https://github.com/getappmap/vscode-appland/commit/cb7e690a030d7f0340c07258b4cc4c9ccba01374))

# [0.8.0](https://github.com/getappmap/vscode-appland/compare/v0.7.0...v0.8.0) (2021-03-05)


### Features

* update @appland/appmap to v1.4.0 ([c7d9a7f](https://github.com/getappmap/vscode-appland/commit/c7d9a7fc294729f4b852e1020ecbe633f50c874f))

# [0.7.0](https://github.com/getappmap/vscode-appland/compare/v0.6.1...v0.7.0) (2021-02-25)


### Features

* update @appland/appmap to v1.2.0 ([#143](https://github.com/getappmap/vscode-appland/issues/143)) ([a1600cf](https://github.com/getappmap/vscode-appland/commit/a1600cf95c498b4e111028dbac351460330e4ff6))

## [0.6.1](https://github.com/getappmap/vscode-appland/compare/v0.6.0...v0.6.1) (2021-02-25)


### Bug Fixes

* documentation improvements ([ea791fa](https://github.com/getappmap/vscode-appland/commit/ea791fa849e8e62fa564b3b51b031b1dca4ae34f))

# [0.6.0](https://github.com/getappmap/vscode-appland/compare/v0.5.1...v0.6.0) (2021-02-23)


### Features

* update @appland/appmap to v1.1.2 ([3b7ca61](https://github.com/getappmap/vscode-appland/commit/3b7ca615c64f17b5008bbfaf699561ae8a501eb6))

## [0.5.1](https://github.com/getappmap/vscode-appland/compare/v0.5.0...v0.5.1) (2021-02-19)


### Bug Fixes

* add additional videos to the README ([#133](https://github.com/getappmap/vscode-appland/issues/133)) ([a2445dd](https://github.com/getappmap/vscode-appland/commit/a2445dd22a92ab0b295931c69016ce728fb4a08e))

# [0.5.0](https://github.com/getappmap/vscode-appland/compare/v0.4.1...v0.5.0) (2021-02-19)


### Features

* update [@appland](https://github.com/appland).appmap to v1.1.1 ([c7add9c](https://github.com/getappmap/vscode-appland/commit/c7add9cf4c970689685695d022519fe2c08582df))

## [0.4.1](https://github.com/getappmap/vscode-appland/compare/v0.4.0...v0.4.1) (2021-02-18)


### Bug Fixes

* reverting package-lock.js to master version ([dc2ea81](https://github.com/getappmap/vscode-appland/commit/dc2ea819c4cb8ec756b5c5f673ef6cade4812275))

# [0.4.0](https://github.com/getappmap/vscode-appland/compare/v0.3.2...v0.4.0) (2021-02-12)


### Features

* update @appland/appmap to v1.0.1 ([f0ac6f3](https://github.com/getappmap/vscode-appland/commit/f0ac6f3b4646fb29c0cddcde59713881d5365f5a))

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
