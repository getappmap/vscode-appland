/* eslint-disable */
const path = require('path');

module.exports = {
  entry: './web/src/app.js',
  output: {
      path: path.resolve(__dirname, '../out'),
      filename: 'app.js',
      devtoolModuleFilenameTemplate: '../[resource-path]',
  },
  devtool: 'source-map',
  resolve: {
      extensions: ['.js'],
      alias: {
        vue: path.resolve('./node_modules/vue'),
        vuex: path.resolve('./node_modules/vuex'),
        '@appland/models': path.resolve('./node_modules/@appland/models'),
        '@appland/diagrams': path.resolve('./node_modules/@appland/diagrams'),
      }
  },
  module: {
    rules: [
      {
        test: /\.m?js$/,
        exclude: /node_modules/,
        use: {
          loader: 'babel-loader',
          options: {
            presets: [
              '@babel/preset-env',
              '@vue/cli-plugin-babel/preset',
            ]
          }
        }
      },
      {
        test: /\.css$/i,
        use: ['style-loader', 'css-loader'],
      },
    ]
  }
};
