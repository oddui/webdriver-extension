'use strict';

const path = require('path');
const Path = {
  lib: path.join(__dirname, 'app/src/lib'),
  test: path.join(__dirname, 'app/test'),
  output: path.join(__dirname, 'app/bundles')
};
const loaders = [
  { test: /\.json$/, loader: 'json' }
];

module.exports = [
  {
    entry: Path.lib,
    output: {
      path: Path.output,
      filename: 'lib.js',
      library: 'webdriver-extension',
      libraryTarget: 'umd'
    },
    module: {
      loaders: loaders
    }
  },
  {
    entry: Path.test,
    output: {
      path: Path.output,
      filename: 'test.js'
    },
    module: {
      loaders: loaders
    },

    // When importing a module whose path matches one of the following, just
    // assume a corresponding global variable exists and use that instead.
    externals: {
      'mocha': 'mocha',
      'sinon': 'sinon'
    }
  }
];
