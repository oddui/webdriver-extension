const semver = require('semver'),
  self = require('../../../package.json'),
  webdriver = require('selenium-webdriver/package.json');

module.exports = semver.parse(self.version);
module.exports['webdriver-version'] = webdriver.version;
