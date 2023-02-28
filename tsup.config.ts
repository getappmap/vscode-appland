import { defineConfig } from 'tsup';

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
    minify: isProduction,
    format: 'iife',
    sourcemap: true,
    esbuildOptions(options) {
      options.define = {
        process: JSON.stringify(processSpoof),
        global: 'globalThis',
      };

      options.resolveExtensions = ['.mjs', '.js', '.ts'];
      options.mainFields = ['browser', 'main'];
      options.logLevel = 'verbose';

      const alias = (options.alias ||= {});
      alias['buffer'] = './node_modules/buffer/index.js';
      alias['crypto'] = './node_modules/crypto-browserify';
      alias['events'] = './node_modules/events';
      alias['http'] = './node_modules/stream-http';
      alias['https'] = './node_modules/stream-http';
      alias['fs'] = './node_modules/browserify-fs';
      alias['fs/promises'] = './node_modules/fs.promises';
      alias['path'] = './node_modules/path';
      alias['stream'] = './node_modules/web-streams-polyfill';
      alias['string_decoder'] = './node_modules/string_decoder';
      alias['tty'] = './node_modules/tty-browserify';
      alias['url'] = './node_modules/url-polyfill';
      alias['util'] = './node_modules/util';
      alias['vue'] = './node_modules/vue/dist/vue.esm.browser.js';
      alias['vuex'] = './node_modules/vuex/dist/vuex.esm.browser.js';
    },
    loader: {
      '.html': 'text',
    },
  },
]);
