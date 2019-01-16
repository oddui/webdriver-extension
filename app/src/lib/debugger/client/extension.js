'use strict';

const EventEmitter = require('events'),
  error = require('selenium-webdriver/lib/error'),
  logging = require('selenium-webdriver/lib/logging');

const DEBUGGING_PROTOCOL_VERSION = '1.2';


/**
 * @extends {EventEmitter}
 *
 * Events
 * `<domain>.<method>`
 * `commandSuccess`
 */
class ExtensionDebugger extends EventEmitter {

  /**
   * Get all tabs
   */
  static list() {
    return new Promise((resolve, reject) => {
      chrome.tabs.query({}, tabs => {
        if (chrome.runtime.lastError) {
          return reject(new Error(chrome.runtime.lastError.message));
        }
        resolve(tabs);
      });
    });
  }

  /**
   * Open an empty tab in a new window
   */
  static new() {
    return new Promise((resolve, reject) => {
      chrome.windows.create({
        url: 'about:blank'
      }, window => {
        if (chrome.runtime.lastError) {
          return reject(new Error(chrome.runtime.lastError.message));
        }
        resolve(window.tabs[0]);
      });
    });
  }

  /**
   * Close tab(s)
   *
   * @param {number|Array<number>} tabIds The tab id or list of tab ids to close
   */
  static close(tabIds) {
    return new Promise((resolve, reject) => {
      chrome.tabs.remove(tabIds, () => {
        if (chrome.runtime.lastError) {
          return reject(new Error(chrome.runtime.lastError.message));
        }
        resolve();
      });
    });
  }

  constructor() {
    super();

    this.tabId_ = null;
    this.nextCommandId_ = 1;
    this.commandInfoMap_ = new Map();

    this.onEvent_ = this.onEvent_.bind(this);
    this.onUnexpectedDetach_ = this.onUnexpectedDetach_.bind(this);

    /** @private {!logging.Logger} */
    this.log_ = logging.getLogger('webdriver.debugger.extension');
  }

  onEvent_(source, method, params) {
    if (source.tabId !== this.tabId_) {
      return;
    }

    this.emit(method, params);

    // A command may have opened the dialog, which will block the response.
    // Reject all registered commands. This is better than risking a hang.
    if (method === 'Page.javascriptDialogOpening') {
      for (let info of this.commandInfoMap_.values()) {
        info.clearTimeout();
        info.reject(new error.UnexpectedAlertOpenError(undefined, params.message));
      }
      this.commandInfoMap_.clear();
    }
  }

  onUnexpectedDetach_(source, detachReason) {
    if (source.tabId !== this.tabId_) {
      return;
    }

    this.detachCleanup_();
    this.log_.finest(`detached from tab: ${detachReason}`);
  }

  detachCleanup_() {
    this.tabId_ = null;
    chrome.debugger.onEvent.removeListener(this.onEvent_);
    chrome.debugger.onDetach.removeListener(this.onUnexpectedDetach_);
    this.removeAllListeners();
  }

  getTabId() {
    return this.tabId_;
  }

  isConnected() {
    return this.tabId_ !== null;
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

  emit(...args) {
    super.emit(...args);
  }

  /**
   * Bind listeners for protocol events. The listener is invoked with the event parameters.
   *
   * @param {!string} eventName
   * @param {function(...)} cb
   */
  on(eventName, cb) {
    super.on(eventName, cb);
  }

  /**
   * Bind a one-time listener for protocol events. The listener is invoked with the event
   * parameters and is removed once it has been invoked.
   *
   * @param {!string} eventName
   * @param {function(...)} cb
   */
  once(eventName, cb) {
    super.once(eventName, cb);
  }

  /**
   * Unbind event listeners
   *
   * @param {!string} eventName
   * @param {function(...)} cb
   */
  off(eventName, cb) {
    super.removeListener(eventName, cb);
  }

  /**
   * Bind listener for command response. The listener is invoked with 3 arguments:
   * (command, response, timeout)
   *
   * @param {function} cb
   */
  onCommandSuccess(cb) {
    this.on('commandSuccess', cb);
  }

  /**
   * Unbind listener for command response
   *
   * @param {function} cb
   */
  offCommandSuccess(cb) {
    this.off('commandSuccess', cb);
  }

  /**
   * Call protocol methods
   *
   * @param {!string} command
   * @param {!Object} params
   * @param {?number} timeout Optional timeout in millisecconds
   * @return {!Promise}
   */
  sendCommand(command, params, timeout) {
    if (!this.isConnected()) {
      return Promise.reject(new Error('Debugger is not connected.'));
    }

    return new Promise((resolve, reject) => {
      this.log_.finest(`method => browser, ${command} ${JSON.stringify(params)}`);

      let commandId = this.nextCommandId_++,
        clearTimeout = () => {};

      if (typeof timeout === 'number') {
        let timer = global.setTimeout(() => {
          this.commandInfoMap_.delete(commandId);

          let message = `${command} timed out after ${timeout} milliseconds`;
          this.log_.severe(message);
          reject(new error.TimeoutError(message));
        }, timeout);

        clearTimeout = () => global.clearTimeout(timer);
      }

      this.commandInfoMap_.set(commandId, {
        resolve,
        reject,
        clearTimeout,
        name: command
      });

      chrome.debugger.sendCommand({tabId: this.tabId_}, command, params, result => {
        if (!this.commandInfoMap_.has(commandId)) {
          // exit if command was timed out or blocked by javascript dialog
          return;
        }

        clearTimeout();

        this.commandInfoMap_.delete(commandId);

        if (chrome.runtime.lastError) {
          this.log_.severe(`method <= browser ERR, ${command} ${chrome.runtime.lastError.message}`);
          return reject(new Error(chrome.runtime.lastError.message));
        }

        // Reject the returning promise for `Runtime.evalute` exceptions while evaluating the expression.
        if (result.exceptionDetails) {
          let error = new Error(`${command} exception was thrown during script execution`);
          error.exceptionDetails = result.exceptionDetails;

          this.log_.severe(`method <= browser ERR, ${error.message}`);
          return reject(error);
        }

        this.log_.finest(`method <= browser OK, ${command} ${JSON.stringify(result)}`);
        this.emit('commandSuccess', command, result, timeout);
        resolve(result);
      });
    });
  }
}


module.exports = ExtensionDebugger;
