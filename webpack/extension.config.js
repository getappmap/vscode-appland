/* eslint-disable */
const path = require('path');
const webpack = require('webpack');

module.exports = {
  target: 'node',
  entry: './src/extension.ts',
  output: {
    path: path.resolve(__dirname, '../out'),
    filename: 'extension.js',
    libraryTarget: 'commonjs',
    devtoolModuleFilenameTemplate: '../[resource-path]',
  },
  devtool: 'source-map',
  externals: {
    vscode: 'commonjs vscode', // the vscode-module is created on-the-fly and must be excluded. Add other modules that cannot be webpack'ed, 📖 -> https://webpack.js.org/configuration/externals/
  },
  // https://github.com/jsdom/jsdom/issues/3042
  plugins: [new webpack.IgnorePlugin(/canvas/, /jsdom$/)],
  resolve: {
    extensions: ['.ts', '.js'],
    alias: {},
  },
  module: {
    rules: [
      {
        test: /\.ts$/,
        exclude: /node_modules/,
        use: ['ts-loader'],
      },
      {
        test: /\.svg$/i,
        use: [
          {
            loader: 'file-loader',
          },
        ],
      },
    ],
  },
};
