/* eslint-disable */
const path = require('path');
const TerserPlugin = require('terser-webpack-plugin');

const isProduction = process.env.NODE_ENV === 'production';

module.exports = {
  entry: './web/src/app.js',
  output: {
    path: path.resolve(__dirname, '../out'),
    filename: 'app.js',
    devtoolModuleFilenameTemplate: '../[resource-path]',
    library: 'AppLandWeb',
  },
  devtool: 'source-map',
  resolve: {
    extensions: ['.js'],
    alias: {
      vue: path.resolve('./node_modules/vue'),
      vuex: path.resolve('./node_modules/vuex'),
    },
    fallback: {
      crypto: 'crypto-js',
    },
  },
  module: {
    rules: [
      {
        test: /\.m?js$/,
        exclude: /node_modules/,
        use: {
          loader: 'babel-loader',
          options: {},
        },
      },
      {
        test: /\.css$/i,
        use: ['style-loader', 'css-loader'],
      },
      {
        test: /\.html$/i,
        loader: 'html-loader',
      },
      {
        test: /\.(svg|ttf)$/i,
        use: [
          {
            loader: 'file-loader',
          },
        ],
      },
    ],
  },
  optimization: {
    minimize: isProduction,
    minimizer: [new TerserPlugin()],
  },
};
