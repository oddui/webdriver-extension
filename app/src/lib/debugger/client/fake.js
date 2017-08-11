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
    this.commandResultMap_ = new Map();
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
    super.on(eventName, cb);
  }

  once(eventName, cb) {
    super.once(eventName, cb);
  }

  off(eventName, cb) {
    super.removeListener(eventName, cb);
  }

  onCommandSuccess(cb) {
    this.on('commandSuccess', cb);
  }

  offCommandSuccess(cb) {
    this.off('commandSuccess', cb);
  }

  sendCommand(command, params, timeout) {
    if (!this.isConnected()) {
      return Promise.reject(new Error('Debugger is not connected.'));
    }

    this.emit('commandSuccess', command, {}, timeout);

    return Promise.resolve(this.commandResultMap_.get(command) || {});
  }

  /**
   * Sets a mock result for a command
   *
   * @param {string} command
   * @param {any} result
   */
  setCommandResult(command, result) {
    this.commandResultMap_.set(command, result);
    return this;
  }
}


module.exports = FakeDebugger;
