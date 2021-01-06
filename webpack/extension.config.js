/* eslint-disable */
const path = require('path');
const { ProvidePlugin } = require('webpack');

module.exports = {
  target: 'node',
  entry: './src/extension.ts',
  output: {
      path: path.resolve(__dirname, '../out'),
      filename: 'extension.js',
      libraryTarget: 'commonjs2',
      devtoolModuleFilenameTemplate: '../[resource-path]',
  },
  devtool: 'source-map',
  externals: {
      vscode: 'commonjs vscode' // the vscode-module is created on-the-fly and must be excluded. Add other modules that cannot be webpack'ed, 📖 -> https://webpack.js.org/configuration/externals/
  },
  resolve: {
      extensions: ['.ts', '.js']
  },
  plugins: [
    new ProvidePlugin({
      Vue: 'vue',
    }),
  ],
  module: {
      rules: [{
          test: /\.ts$/,
          exclude: /node_modules/,
          use: [{
              loader: 'ts-loader',
              options: {
                  compilerOptions: {
                      'module': 'es6'
                  }
              }
          }]
      }]
  },
}
