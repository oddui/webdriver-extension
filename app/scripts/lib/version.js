const semver = require('semver'),
  self = require('json!../../../package.json'),
  webdriver = require('json!selenium-webdriver/package.json');

module.exports = semver.parse(self.version);
module.exports['webdriver-version'] = webdriver.version;
