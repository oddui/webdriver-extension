'use strict';


const error = require('selenium-webdriver/lib/error'),
  logging = require('selenium-webdriver/lib/logging');


/**
 * Track the opening and closing of JavaScript dialogs (alert, confirm, prompt, or onbeforeunload)
 *
 * See chromedriver JavaScriptDialogManager
 * https://cs.chromium.org/chromium/src/chrome/test/chromedriver/chrome/javascript_dialog_manager.h
 */
class JavaScriptDialogManager {

  constructor() {
    this.debugger_ = null;
    this.log_ = logging.getLogger('webdriver.extension.JavaScriptDialogManager');
    this.unhandledDialogQueue_ = [];

    this.onJavaScriptDialogOpening_ = this.onJavaScriptDialogOpening_.bind(this);
    this.onJavaScriptDialogClosed_ = this.onJavaScriptDialogClosed_.bind(this);
  }

  onJavaScriptDialogOpening_(params) {
    let message = params.message;

    if (typeof message !== 'string') {
      throw new error.WebDriverError('Page.javascriptDialogOpening parameters has invalid message.');
    }

    this.unhandledDialogQueue_.push(message);
  }

  onJavaScriptDialogClosed_() {
    // 'Page.javascriptDialogClosed' is only sent when all dialogs have been closed.
    // Clear the unhandled queue in case the user closed a dialog manually.
    this.unhandledDialogQueue_.length = 0;
  }

  /**
   * Add listners to debugger and start tracking JavaScript dialogs for the debuggee
   *
   * @param {Debugger} dbg
   */
  connect(dbg) {
    this.debugger_ = dbg;
    this.unhandledDialogQueue_.length = 0;

    this.debugger_.on('Page.javascriptDialogOpening', this.onJavaScriptDialogOpening_);
    this.debugger_.on('Page.javascriptDialogClosed', this.onJavaScriptDialogClosed_);

    return this.debugger_.sendCommand('Page.enable');
  }

  isDialogOpen() {
    return this.unhandledDialogQueue_.length > 0;
  }

  getDialogMessage() {
    if (!this.isDialogOpen()) {
      throw new error.NoSuchAlertError();
    }

    return this.unhandledDialogQueue_[0];
  }

  handleDialog(accept, text) {
    if (!this.isDialogOpen()) {
      return Promise.reject(new error.NoSuchAlertError());
    }

    return this.debugger_.sendCommand('Page.handleJavaScriptDialog', {
      accept: accept,
      promptText: text
    })
      .then(() => this.unhandledDialogQueue_.shift());
  }
}


module.exports = JavaScriptDialogManager;
