'use strict';

const webdriver = require('./lib');

chrome.runtime.onInstalled.addListener(function (details) {
  console.log('previousVersion', details.previousVersion);
});

chrome.browserAction.onClicked.addListener(runSpecs);

function runSpecs() {
  chrome.tabs.create({
    url: chrome.extension.getURL('test/index.html')
  });
}
