'use strict';

const webdriver = require('../src/lib/index'),
  chrome = require('../src/lib/chrome'),
  By = webdriver.By,
  until = webdriver.until,
  Builder = webdriver.Builder;

if (process.browser) {
  // only run in browser

  run();
  run(true);
}

/**
 * Run e2e tests
 *
 * @param {boolean} remote Whether to use http webdriver server.
 */
function run(remote) {
  webdriver.logging.installConsoleHandler();

  ['webdriver.extension', 'webdriver.http']
    .forEach(function(name) {
      webdriver.logging.getLogger(name)
        .setLevel(webdriver.logging.Level.ALL);
    });

  // chrome specific options/capabilities
  let chromeOptions = new chrome.Options()
    .setMobileEmulation({deviceName: 'Google Nexus 5'});

  let builder = new Builder()
    .forBrowser('chrome')
    .setChromeOptions(chromeOptions);

  if (remote) {
    // manually started webdriver server
    builder.usingServer('http://127.0.0.1:9515');
  }

  let driver = builder.build();


  let message = [];
  driver.call(message.push, message, 'a').then(function() {
    driver.call(message.push, message, 'b');
  });
  driver.call(message.push, message, 'c');
  driver.call(function() {
    console.log('message is abc? ' + (message.join('') === 'abc'));
  });


  driver.get('http://www.google.com/ncr');
  driver.findElement(By.name('q')).sendKeys('webdriver');
  driver.findElement(By.name('btnG')).click();
  driver.wait(until.titleIs('webdriver - Google Search'), 5000);
  driver.quit();
}
