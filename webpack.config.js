const path = require('path');

const PATHS = {
  app: path.join(__dirname, 'app'),
  lib: path.join(__dirname, 'app/scripts/lib'),
  dist: path.join(__dirname, 'dist')
};

module.exports = {
  entry: PATHS.lib,
  output: {
    path: PATHS.dist,
    filename: 'bundle.js'
  }
};
