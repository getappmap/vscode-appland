import { defineConfig } from 'tsup';

const isProduction = process.env.NODE_ENV === 'production';

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
    inject: ['web/polyfillShim.js'],
    define: {
      global: 'globalThis',
    },
    esbuildOptions(options) {
      options.resolveExtensions = ['.mjs', '.js', '.ts'];
      options.platform = 'browser';
      options.alias = {
        ...(options.alias || {}),
        assert: 'assert',
        process: 'process/browser',
        http: 'stream-http',
        https: 'https-browserify',
        stream: 'stream-browserify',
        url: 'url',
        util: 'util',
        'socket.io-client': './node_modules/socket.io-client/dist/socket.io.js',
        vue: './node_modules/vue/dist/vue.esm.browser.js',
        vuex: './node_modules/vuex/dist/vuex.esm.browser.js',
      };
    },
    loader: {
      '.html': 'text',
    },
  },
]);
