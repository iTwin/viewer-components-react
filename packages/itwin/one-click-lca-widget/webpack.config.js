/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
const glob = require("glob");
const path = require("path");

module.exports = {
  mode: "development",
  entry: glob.sync(path.resolve(__dirname, "lib/cjs/**/*.test.js")),
  output: {
    path: path.resolve(__dirname, "lib/test/webpack"),
    filename: "bundled-tests.js",
    devtoolModuleFilenameTemplate: "file:///[absolute-resource-path]"
  },
  resolve: {
    fallback: {
      os: require.resolve("os-browserify/browser"),
      url: require.resolve("url"),
      path: require.resolve("path-browserify"),
      timers: require.resolve("timers-browserify"),
    }
  },
  devtool: "nosources-source-map",
  module: {
    noParse: [
      /draco_decoder_nodejs.js$/,
      /draco_encoder_nodejs.js$/
    ],
    rules: [
      {
        test: /\.js$/,
        use: "source-map-loader",
        enforce: "pre"
      },
      {
        test: /azure-storage|AzureFileHandler|UrlFileHandler|dotenv/,
        use: "null-loader"
      },
      {
        test: /\.(css|scss)$/,
        use: "null-loader"
      },
      {
        test: /\.(png|woff|woff2|eot|ttf|svg)$/,
        use: "url-loader"
      }
    ]
  },
  stats: "errors-only",
  optimization: {
    nodeEnv: "development"
  },
  externals: {
    electron: "commonjs electron",
  },
};