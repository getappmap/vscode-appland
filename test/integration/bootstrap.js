/* eslint-env node */
/* eslint-disable @typescript-eslint/no-var-requires */
// Entry point for the VS Code extension test host (referenced as `extensionTestsPath`).
//
// It must be plain JS because the host loads it before any TypeScript tooling is active.
// It registers ts-node so the host can load index.ts and the .ts test files directly —
// no separate `tsc` compile step is needed before running integration tests. Type
// checking is still enforced separately by `yarn pretest`.
const { resolve } = require('path');

process.env.TS_NODE_PROJECT = resolve(__dirname, '../../tsconfig.json');
require('ts-node/register/transpile-only');

module.exports = require('./index');
