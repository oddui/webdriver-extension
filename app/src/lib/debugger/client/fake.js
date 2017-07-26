'use strict';

const EventEmitter = require('events');


let tabs = [],
  nextTabId = 0;


/**
 * @extends {EventEmitter}
 */
class FakeDebugger extends EventEmitter {

  static list() {
    return Promise.resolve(tabs);
  }

  static new() {
    let tab = { id: nextTabId++ };
    tabs.push(tab);
    return Promise.resolve(tab);
  }

  static close(tabIds) {
    tabIds.forEach(id => {
      let tabAt = tabs.findIndex(tab => tab.id === id);

      if (tabAt !== -1) {
        tabs.splice(tabAt, 1);
      }
    });
    return Promise.resolve();
  }

  constructor() {
    super();

    this.tabId_ = null;
    this.commandToResultMap_ = new Map();
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
    return Promise.resolve(tabId);
  }

  disconnect() {
    if (this.tabId_ === null) {
      return Promise.resolve();
    }

    this.tabId_ = null;
    this.removeAllListeners();
    return Promise.resolve();
  }

  on(eventName, cb) {
    if (this.tabId_ === null) {
      throw new Error('connect() must be called before attempting to listen to events.');
    }

    super.on(eventName, cb);
  }

  once(eventName, cb) {
    if (this.tabId_ === null) {
      throw new Error('connect() must be called before attempting to listen to events.');
    }

    super.once(eventName, cb);
  }

  off(eventName, cb) {
    if (this.tabId_ === null) {
      throw new Error('connect() must be called before attempting to listen to events.');
    }

    super.removeListener(eventName, cb);
  }

  onCommandSuccess(cb) {
    if (this.tabId_ === null) {
      throw new Error('connect() must be called before attempting to listen to events.');
    }

    super.on('commandSuccess', cb);
  }

  offCommandSuccess(cb) {
    if (this.tabId_ === null) {
      throw new Error('connect() must be called before attempting to listen to events.');
    }

    super.removeListener('commandSuccess', cb);
  }

  sendCommand(command, params, timeout) {
    if (this.tabId_ === null) {
      return Promise.reject(new Error('connect() must be called before attempting to send commands.'));
    }

    this.emit('commandSuccess', command, {}, timeout);

    return Promise.resolve(this.commandToResultMap_.get(command) || {});
  }

  /**
   * Sets a mock result for a command
   *
   * @param {string} command
   * @param {any} result
   */
  setCommandResult(command, result) {
    this.commandToResultMap_.set(command, result);
    return this;
  }
}


module.exports = FakeDebugger;