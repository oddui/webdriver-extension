'use strict';

const EventEmitter = require('events'),
  logging = require('selenium-webdriver/lib/logging');

const DEBUGGING_PROTOCOL_VERSION = '1.1';


/**
 * @extends {EventEmitter}
 */
class Debugger extends EventEmitter {
  constructor() {
    super();

    this.tabId_ = null;
    this.onEvent_ = this.onEvent_.bind(this);
    this.onUnexpectedDetach_ = this.onUnexpectedDetach_.bind(this);

    /** @private {!logging.Logger} */
    this.log_ = logging.getLogger('webdriver.extension.Debugger');
  }

  onEvent_(debuggee, method, params) {
    this.emit(method, params);
  }

  onUnexpectedDetach_(debuggee, detachReason) {
    this.detachCleanup_();
    this.log_.finest(`debugger detached from browser: ${detachReason}`);
  }

  detachCleanup_() {
    this.tabId_ = null;
    chrome.debugger.onEvent.removeListener(this.onEvent_);
    chrome.debugger.onDetach.removeListener(this.onUnexpectedDetach_);
    this.removeAllListeners();
  }

  connect(tabId) {
    if (this.tabId_ !== null) {
      return Promise.resolve();
    }

    this.tabId_ = tabId;
    chrome.debugger.onEvent.addListener(this.onEvent_);
    chrome.debugger.onDetach.addListener(this.onUnexpectedDetach_);

    return new Promise((resolve, reject) => {
      chrome.debugger.attach({tabId}, DEBUGGING_PROTOCOL_VERSION, () => {
        if (chrome.runtime.lastError) {
          return reject(chrome.runtime.lastError);
        }
        resolve(tabId);
      });
    });
  }

  disconnect() {
    if (this.tabId_ === null) {
      return Promise.resolve();
    }

    const tabId = this.tabId_;
    return new Promise((resolve, reject) => {
      chrome.debugger.detach({tabId}, () => {
        if (chrome.runtime.lastError) {
          return reject(chrome.runtime.lastError);
        }
        resolve();
      });
    }).then(() => this.detachCleanup_());
  }

  /**
   * Bind listeners for protocol events
   * @param {!string} eventName
   * @param {function(...)} cb
   */
  on(eventName, cb) {
    if (this.tabId_ === null) {
      throw new Error('connect() must be called before attempting to listen to events.');
    }

    this.log_.finest(`listen for event => ${eventName}`);
    super.on(eventName, cb);
  }

  /**
   * Bind a one-time listener for protocol events. Listener is removed once it
   * has been called.
   * @param {!string} eventName
   * @param {function(...)} cb
   */
  once(eventName, cb) {
    if (this.tabId_ === null) {
      throw new Error('connect() must be called before attempting to listen to events.');
    }

    this.log_.finest(`listen once for event => ${eventName}`);
    super.once(eventName, cb);
  }

  /**
   * Unbind event listeners
   * @param {!string} eventName
   * @param {function(...)} cb
   */
  off(eventName, cb) {
    if (this.tabId_ === null) {
      throw new Error('connect() must be called before attempting to listen to events.');
    }

    super.off(eventName, cb);
  }

  /**
   * Call protocol methods
   *
   * @param {!string} command
   * @param {!Object} params
   * @return {!Promise}
   */
  sendCommand(command, params) {
    if (this.tabId_ === null) {
      throw new Error('connect() must be called before attempting to send commands.');
    }

    return new Promise((resolve, reject) => {
      this.log_.finest(`method => browser, ${command} ${JSON.stringify(params)}`);

      chrome.debugger.sendCommand({tabId: this.tabId_}, command, params, result => {
        if (chrome.runtime.lastError) {
          this.log_.severe(`method <= browser ERR, ${command} ${JSON.stringify(chrome.runtime.lastError)}`);
          return reject(chrome.runtime.lastError);
        }

        if (result.wasThrown) {
          this.log_.severe(`method <= browser ERR, ${command} ${JSON.stringify(result)}`);
          return reject(result.exceptionDetails);
        }

        this.log_.finest(`method <= browser OK, ${command} ${JSON.stringify(result)}`);
        resolve(result);
      });
    });
  }
}


module.exports = Debugger;
