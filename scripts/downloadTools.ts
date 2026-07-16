// Headlessly download the AppMap CLI tools (appmap, scanner, java agent) into ~/.appmap,
// reusing the extension's real AssetService via the unit-test vscode mock.
//
// CI runs this as its own step so the tools are present (and cacheable) before the
// integration tests start. That keeps download latency — a source of timing flakiness in the
// tests, which spawn these binaries as background processes — out of the test run, and makes
// a broken download fail in an obvious, dedicated step instead of as a mysterious test timeout.
import '../test/unit/mock/vscode';

import AssetService from '../src/assets/assetService';

async function main(): Promise<void> {
  // updateAll(true) downloads every asset to the latest manifest version and links it into
  // ~/.appmap/bin, awaiting completion and throwing on any download error.
  await AssetService.updateAll(true);
  console.log('AppMap tools downloaded to ~/.appmap');
}

main().then(
  () => process.exit(0),
  (e) => {
    console.error('Failed to download AppMap tools:', e);
    process.exit(1);
  }
);
