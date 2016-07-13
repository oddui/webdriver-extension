'use strict';

const webdriver = require('../src/lib/index'),
  chrome = require('../src/lib/chrome'),
  By = webdriver.By,
  until = webdriver.until,
  Builder = webdriver.Builder;

if (process.browser) {
  // only run in browser
  run();
}

function run() {

  // chrome specific options/capabilities
  let chromeOptions = new chrome.Options()
    .setMobileEmulation({deviceName: 'Google Nexus 5'});


  let driver = new Builder()

    .forBrowser('chrome')
    .setChromeOptions(chromeOptions)

    //.forBrowser('firefox')
    //.forBrowser('safari')

    // manually started webdriver servers
    .usingServer('http://127.0.0.1:4444/wd/hub')
    .usingServer('http://127.0.0.1:9515')

    .build();


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
