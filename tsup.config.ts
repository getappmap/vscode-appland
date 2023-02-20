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
    esbuildOptions(options) {
      options.resolveExtensions = ['.mjs', '.js', '.ts'];
      options.mainFields = ['browser', 'main'];
      const alias = (options.alias ||= {});
      alias['vue'] = './node_modules/vue/dist/vue.esm.browser.js';
      alias['vuex'] = './node_modules/vuex/dist/vuex.esm.browser.js';
      alias['buffer'] = './node_modules/buffer/index.js';
    },
    loader: {
      '.html': 'text',
    },
  },
]);
