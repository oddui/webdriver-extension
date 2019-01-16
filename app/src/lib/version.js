const self = require('../../../package.json'),
  webdriver = require('selenium-webdriver/package.json');

module.exports = `${self.version} (selenium-webdriver ${webdriver.version})`;
