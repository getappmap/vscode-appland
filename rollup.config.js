import resolve from '@rollup/plugin-node-resolve';
import postcss from 'rollup-plugin-postcss';
import sucrase from '@rollup/plugin-sucrase';
import eslint from '@rollup/plugin-eslint';

export default [
  {
    input: 'src/extension.ts',
    output: {
      file: 'out/extension.js',
      format: 'cjs'
    },
    plugins: [
      resolve(),
      eslint({
        exclude: 'src/scss/**',
      }),
      sucrase({
        exclude: ["node_modules/**"],
        transforms: ["typescript"],
      })
    ],
  },

  {
    input: 'media/scenario.js',
    output: {
      file: 'out/scenario.js',
      format: 'iife'
    },
    plugins: [
      resolve({ browser: true }),
      postcss({ extract: true }),
    ],
  },
];
