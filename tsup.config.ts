import { defineConfig } from 'tsup';
import { NodeGlobalsPolyfillPlugin } from '@esbuild-plugins/node-globals-polyfill';
import { NodeModulesPolyfillPlugin } from '@esbuild-plugins/node-modules-polyfill';

const isProduction = process.env.NODE_ENV === 'production';
const processSpoof = { env: {}, argv: [] };

export default defineConfig([
  {
    entry: ['src/extension.ts'],
    outDir: 'out',
    external: ['vscode'],
    noExternal: [/^(?!vscode$)/],
    sourcemap: true,
    loader: {
      '.html': 'text',
    },
    minify: isProduction,
    target: 'node16',
    publicDir: 'ext',
  },
  {
    entry: ['web/src/app.js'],
    outDir: 'out',
    noExternal: [/./],
    outExtension: () => ({ js: '.js' }),
    target: 'chrome102',
    minify: false,
    format: 'iife',
    sourcemap: true,
    treeshake: true,
    // plugins: [
    //   NodeModulesPolyfillPlugin(),
    //   NodeGlobalsPolyfillPlugin({
    //     buffer: true,
    //   }),
    // ],
    inject: ['web/global.ts', 'rollup-plugin-inject'],
    esbuildOptions(options) {
      options.define = {
        process: JSON.stringify(processSpoof),
        global: 'globalThis',
      };

      options.resolveExtensions = ['.mjs', '.js', '.ts'];
      options.mainFields = ['browser', 'main'];
      options.logLevel = 'verbose';
      options.alias = {
        ...(options.alias || {}),
        assert: 'rollup-plugin-node-polyfills/polyfills/assert',
        buffer: 'rollup-plugin-node-polyfills/polyfills/buffer-es6',
        events: 'rollup-plugin-node-polyfills/polyfills/events',
        fs: 'browserify-fs',
        'fs/promises': 'fs.promises',
        path: 'rollup-plugin-node-polyfills/polyfills/path',
        process: 'rollup-plugin-node-polyfills/polyfills/process-es6',
        punycode: 'rollup-plugin-node-polyfills/polyfills/punycode',
        querystring: 'rollup-plugin-node-polyfills/polyfills/qs',
        stream: 'rollup-plugin-node-polyfills/polyfills/stream',
        string_decoder: 'rollup-plugin-node-polyfills/polyfills/string-decoder',
        tty: 'rollup-plugin-node-polyfills/polyfills/tty',
        url: 'rollup-plugin-node-polyfills/polyfills/url',
        util: 'rollup-plugin-node-polyfills/polyfills/util',
      };
    },
    loader: {
      '.html': 'text',
    },
  },
]);
