const path = require('path');
const paths = {
  lib: path.join(__dirname, 'app/scripts/lib'),
  test: path.join(__dirname, 'app/test')
};
const loaders = [
  { test: /\.css$/, loader: 'style!css' },
  { test: /\.json$/, loader: 'json' }
];

module.exports = [
  {
    entry: paths.lib,
    output: {
      path: paths.lib,
      filename: 'bundle.js',
      library: 'webdriver-extension',
      libraryTarget: 'umd'
    },
    module: {
      loaders: loaders
    }
  },
  {
    entry: paths.test,
    output: {
      path: paths.test,
      filename: 'bundle.js'
    },
    module: {
      loaders: loaders,
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
