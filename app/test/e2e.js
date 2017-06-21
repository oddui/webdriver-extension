'use strict';

const webdriver = require('../src/lib/index'),
  chrome = require('../src/lib/chrome'),
  By = webdriver.By,
  until = webdriver.until,
  Builder = webdriver.Builder;


describe('e2e', () => {
  let builder;

  if (!process.browser) {
    // only run in browser
    return;
  }

  before(() => {
    webdriver.logging.installConsoleHandler();

    ['webdriver.extension', 'webdriver.http'].forEach(name => {
      webdriver.logging.getLogger(name).setLevel(webdriver.logging.Level.ALL);
    });
  });

  beforeEach(() => {
    // chrome specific options/capabilities
    let chromeOptions = new chrome.Options()
      .setMobileEmulation({deviceName: 'Google Nexus 5'});

    builder = new Builder()
      .forBrowser('chrome')
      .setChromeOptions(chromeOptions);
  });


  ['extension', 'http'].forEach(type => {
    describe(type, () => {
      let driver;

      beforeEach(() => {
        if (type === 'http') {
          // manually started webdriver server
          builder.usingServer('http://127.0.0.1:9515');
        }
        driver = builder.build();
      });

      afterEach(() => driver.quit());

      it('should append query to title', () => {
        return driver.get('http://www.google.com/ncr')
          .then(() => driver.findElement(By.name('q')).sendKeys('webdriver'))
          .then(() => driver.findElement(By.name('btnG')).click())
          .then(() => driver.wait(until.titleIs('webdriver - Google Search'), 5000));
      });

      it('throws if blocking dialog', () => {
        // TODO: fix different behaviours between extension and http
        return driver.get('http://127.0.0.1:8080/pageWithOnLoad.html')
          .then(() => driver.navigate().refresh());
      });
    });
  });
});
