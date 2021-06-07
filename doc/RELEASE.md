# Releasing the AppMap extension for Visual Studio Code

[![semantic-release](https://img.shields.io/badge/%20%20%F0%9F%93%A6%F0%9F%9A%80-semantic--release-e10079.svg)](https://github.com/semantic-release/semantic-release)

Commits that land on the `master` branch are automatically candidates for release through
[`semantic-release`](https://semantic-release.gitbook.io). We use
[conventional commits](https://www.conventionalcommits.org/) to determine which commits are
releasable, then bumping the version and updating the change log accordingly.

As a result, commits should not directly modify `version` in `package.json` or alter the
`CHANGELOG.md`.

## Releasing patch notes

To create a release which publishes patch notes in the application, two steps are required. First,
modify [`patch_notes.html`](../web/static/html/patch_notes.html). This document is injected into the
AppMap view via an `iframe`.

To cause the patch notes notification to appear after users update, change the `releaseKey` property
in `package.json`. This key contains an aribitrary string, but the best practice is to use the
`version` value that will display the notification.

Because `semantic-release` updates the version automatically, we need to know which version will be
published. In short, commits which begin with `fix:` will bump the patch version, while `feat:` will
bump the minor version.

## Co-ordinating multiple features into a single release

Use an intermediate branch (such as `next-release`) to hold changes pending release. Once all
changes have been completed and reviewed, merge the intermediate branch into `master`.
