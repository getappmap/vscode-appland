import { defineConfig } from 'tsup';
import polyfills from 'node-libs-browser';

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
      process: 'process',
      Buffer: 'Buffer',
    },
    esbuildOptions(options) {
      options.resolveExtensions = ['.mjs', '.js', '.ts'];
      options.mainFields = ['browser', 'main'];
      options.alias = {
        ...(options.alias || {}),
        ...Object.entries(polyfills)
          .filter(([, modulePath]) => Boolean(modulePath))
          .reduce((memo, [name, modulePath]) => {
            memo[name] = modulePath;
            return memo;
          }, {}),
        fs: './node_modules/browserify-fs',
        'socket.io-client': './node_modules/socket.io-client/dist/socket.io.js',
        vue: './node_modules/vue/dist/vue.esm.browser.js',
        vuex: './node_modules/vuex/dist/vuex.esm.browser.js',
        uuid: './node_modules/uuid/dist/esm-browser/index.js',
      };
    },
    loader: {
      '.html': 'text',
    },
  },
]);
