'use strict';

const error = require('selenium-webdriver/lib/error'),
  logging = require('selenium-webdriver/lib/logging');


let CRI = require('chrome-remote-interface'),
  host = 'localhost',
  port = 9222;


/**
 * Events
 * `<domain>.<method>`
 * `commandSuccess`
 *
 * CriDebugger specific events, see https://github.com/cyrus-and/chrome-remote-interface#cdplistoptions-callback
 * `event`, `ready`, `disconnect`
 */
class CriDebugger {

  static set CRI(value) {
    CRI = value;
  }

  static set host(value) {
    host = value;
  }

  static get host() {
    return host;
  }

  static set port(value) {
    port = value;
  }

  static get port() {
    return port;
  }

  static list() {
    return CRI.List({ host, port });
  }

  static new() {
    return CRI.New({ host, port });
  }

  /**
   * Close tab(s)
   *
   * @param {String|Array<String>} tabIds The tab id or list of tab ids to close
   */
  static close(tabIds) {
    if (Array.isArray(tabIds)) {
      return Promise.all(tabIds.map(id => CRI.Close({ host, port, id })));
    } else {
      return CRI.Close({ host, port, id: tabIds });
    }
  }

  constructor() {
    this.tabId_ = null;
    this.client_ = null;
    this.nextCommandId_ = 1;
    this.commandInfoMap_ = new Map();

    this.onEvent_ = this.onEvent_.bind(this);
    this.onUnexpectedDetach_ = this.onUnexpectedDetach_.bind(this);

    /** @private {!logging.Logger} */
    this.log_ = logging.getLogger('webdriver.debugger.cri');
  }

  onEvent_(message) {
    // A command may have opened the dialog, which will block the response.
    // Reject all registered commands. This is better than risking a hang.
    if (message.method === 'Page.javascriptDialogOpening') {
      for (let info of this.commandInfoMap_.values()) {
        info.clearTimeout();
        info.reject(new error.UnexpectedAlertOpenError(undefined, message.params.message));
      }
      this.commandInfoMap_.clear();
    }
  }

  onUnexpectedDetach_() {
    this.detachCleanup_();
    this.log_.finest(`detached from tab`);
  }

  detachCleanup_() {
    this.client_.removeAllListeners();

    this.client_ = null;
    this.tabId_ = null;
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

    return CRI({ host, port, target: tabId })
      .then(client => {
        this.tabId_ = tabId;
        this.client_ = client;

        this.client_.on('event', this.onEvent_);
        this.client_.on('disconnect', this.onUnexpectedDetach_);
      });
  }

  disconnect() {
    if (this.tabId_ === null) {
      return Promise.resolve();
    }

    return this.client_.close()
      .then(() => this.detachCleanup_());
  }

  emit(...args) {
    this.client_.emit(...args);
  }

  /**
   * Bind listeners for protocol events. The listener is invoked with the event parameters.
   *
   * @param {!string} eventName
   * @param {function(...)} cb
   */
  on(eventName, cb) {
    this.client_.on(eventName, cb);
  }

  /**
   * Bind a one-time listener for protocol events. The listener is invoked with the event
   * parameters and is removed once it has been invoked.
   *
   * @param {!string} eventName
   * @param {function(...)} cb
   */
  once(eventName, cb) {
    this.client_.once(eventName, cb);
  }

  /**
   * Unbind event listeners
   *
   * @param {!string} eventName
   * @param {function(...)} cb
   */
  off(eventName, cb) {
    this.client_.removeListener(eventName, cb);
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

      this.client_.send(command, params, (error, response) => {
        if (!this.commandInfoMap_.has(commandId)) {
          // exit if command was timed out or blocked by javascript dialog
          return;
        }

        clearTimeout();

        this.commandInfoMap_.delete(commandId);

        if (error) {
          this.log_.severe(`method <= browser ERR, ${command} ${response.message}`);
          return reject(response);
        }

        // Reject the returning promise for `Runtime.evalute` exceptions while evaluating the expression.
        if (response.exceptionDetails) {
          let error = new Error(`${command} exception was thrown during script execution`);
          error.exceptionDetails = response.exceptionDetails;

          this.log_.severe(`method <= browser ERR, ${error.message}`);
          return reject(error);
        }

        this.log_.finest(`method <= browser OK, ${command} ${JSON.stringify(response)}`);
        this.client_.emit('commandSuccess', command, response, timeout);
        resolve(response);
      });
    });
  }
}


module.exports = CriDebugger;
