const by = require('selenium-webdriver/lib/by');
const logging = require('selenium-webdriver/lib/logging');
const until = require('selenium-webdriver/lib/until');
const version = require('./version');
const builder = require('./builder');

/**
 * disable promise manager
 *
 * @see <https://github.com/SeleniumHQ/selenium/issues/2969>
 */
require('selenium-webdriver/lib/promise').USE_PROMISE_MANAGER = false;

exports.Builder = builder.Builder;
exports.By = by.By;
exports.logging = logging;
exports.until = until;
exports.version = version;
