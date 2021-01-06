import resolve from '@rollup/plugin-node-resolve';
import scss from 'rollup-plugin-scss';
import sucrase from '@rollup/plugin-sucrase';
import eslint from '@rollup/plugin-eslint';

export default {
  input: 'src/extension.ts',
  output: {
    file: 'out/extension.js',
    format: 'cjs'
  },
  external: [ 'vscode' ],
  plugins: [
    resolve(),
    scss(),
    eslint({
      exclude: 'src/scss/**',
    }),
    sucrase({
      exclude: ["node_modules/**"],
      transforms: ["typescript"],
    })
  ],
};
