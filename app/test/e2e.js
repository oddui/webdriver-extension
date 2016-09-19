'use strict';

const webdriver = require('../src/lib/index'),
  chrome = require('../src/lib/chrome'),
  By = webdriver.By,
  until = webdriver.until,
  Builder = webdriver.Builder;


describe('e2e', function() {
  let builder;

  if (!process.browser) {
    // only run in browser
    return;
  }

  before(function() {
    webdriver.logging.installConsoleHandler();

    ['webdriver.extension', 'webdriver.http'].forEach(function(name) {
      webdriver.logging.getLogger(name).setLevel(webdriver.logging.Level.ALL);
    });
  });

  beforeEach(function() {
    // chrome specific options/capabilities
    let chromeOptions = new chrome.Options()
      .setMobileEmulation({deviceName: 'Google Nexus 5'});

    builder = new Builder()
      .forBrowser('chrome')
      .setChromeOptions(chromeOptions);
  });


  describe('extension', function() {
    let driver;

    beforeEach(function() {
      driver = builder.build();
    });

    afterEach(function() {
      return driver.quit();
    });

    it('should append query to title', function() {
      driver.get('http://www.google.com/ncr');
      driver.findElement(By.name('q')).sendKeys('webdriver');
      driver.findElement(By.name('btnG')).click();
      return driver.wait(until.titleIs('webdriver - Google Search'), 5000);
    });
  });


  describe('http', function() {
    let driver;

    beforeEach(function() {
      // manually started webdriver server
      builder.usingServer('http://127.0.0.1:9515');
      driver = builder.build();
    });

    afterEach(function() {
      return driver.quit();
    });

    it('should append query to title', function() {
      driver.get('http://www.google.com/ncr');
      driver.findElement(By.name('q')).sendKeys('webdriver');
      driver.findElement(By.name('btnG')).click();
      return driver.wait(until.titleIs('webdriver - Google Search'), 5000);
    });
  });

});
