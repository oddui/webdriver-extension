'use strict';

const path = require('path');
const Path = {
  lib: path.join(__dirname, 'app/src/lib'),
  test: path.join(__dirname, 'app/test'),
  output: path.join(__dirname, 'app/bundles')
};

module.exports = [
  {
    entry: Path.lib,
    output: {
      path: Path.output,
      filename: 'lib.js',
      library: 'webdriver-extension',
      libraryTarget: 'umd'
    }
  },
  {
    entry: Path.test,
    output: {
      path: Path.output,
      filename: 'test.js'
    }
  }
];
