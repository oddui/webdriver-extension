const path = require('path');

const PATHS = {
  app: path.join(__dirname, 'app'),
  lib: path.join(__dirname, 'app/scripts/lib'),
  test: path.join(__dirname, 'app/test'),
  dist: path.join(__dirname, 'dist')
};

module.exports = [
  {
    entry: PATHS.lib,
    output: {
      path: PATHS.dist,
      filename: 'bundle.js',
      library: 'webdriver-extension',
      libraryTarget: 'umd'
    }
  },
  {
    entry: PATHS.test,
    output: {
      path: PATHS.test,
      filename: 'bundle.js'
    },
    module: {
      noParse: [
        /node_modules\/mocha\/mocha\.js$/,
        /node_modules\/sinon\//
      ]
    },
    resolve: {
      alias: {
        sinon: require.resolve('sinon/pkg/sinon')
      }
    }
  }
];
