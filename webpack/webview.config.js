/* eslint-disable */
const path = require('path');
const { ProvidePlugin } = require('webpack');

module.exports = {
  entry: './media/scenario.js',
  output: {
      path: path.resolve(__dirname, '../out'),
      filename: 'scenario.js',
      devtoolModuleFilenameTemplate: '../[resource-path]',
  },
  devtool: 'inline-source-map',
  resolve: {
      extensions: ['.js'],
  },
  plugins: [
    new ProvidePlugin({
      $: 'jquery',
      jQuery: 'jquery'
    }),
  ],
  module: {
    rules: [
      {
        test: /\.m?js$/,
        exclude: /node_modules/,
        use: {
          loader: 'babel-loader',
          options: {
            presets: ['@babel/preset-env']
          }
        }
      },
      {
        test: /\.css$/i,
        use: ['style-loader', 'css-loader'],
      },
      {
        test: /\.s[ac]ss$/i,
        use: [
          // Creates `style` nodes from JS strings
          'style-loader',
          // Translates CSS into CommonJS
          'css-loader',
          // Compiles Sass to CSS
          'sass-loader',
        ],
      },
    ]
  }
};
