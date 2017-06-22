'use strict';

const path = require('path');
const Path = {
  app: path.resolve(__dirname, 'app'),
  output: path.resolve(__dirname, 'app/scripts')
};

module.exports = {
  background: {
    context: Path.app,
    entry: './src/background.js',
    output: {
      path: Path.output,
      filename: 'background.js'
    }
  },
  test: {
    context: Path.app,
    entry: './test/index.js',
    output: {
      path: Path.output,
      filename: 'test.js'
    }
  }
};
