'use strict';


class EventEmitter {
  constructor() {
    this.listeners_ = [];
  }

  addListener(listener) {
    this.listeners_.push(listener);
  }

  removeListener(listener) {
    let i = this.listeners_.indexOf(listener);

    if (i > -1) {
      this.listeners_.splice(i, 1);
    }
  }

  removeAllListeners() {
    this.listeners_.length = 0;
  }

  emit() {
    let args = arguments;

    this.listeners_.forEach(function(listener) {
      listener.apply(null, args);
    });
  }
}


function debuggerApi() {

  let onEvent = new EventEmitter(),
    onDetach = new EventEmitter(),
    commandDuration = 0;

  function emitEvent(source, method, params) {
    onEvent.emit(source, method, params);
  }

  function emitDetach(source, detachReason) {
    onDetach.emit(source, detachReason);
  }

  function setCommandDuration(duration) {
    commandDuration = duration;
  }

  function attach(source, version, cb) {
    setTimeout(cb);
  }

  function detach(source, cb) {
    setTimeout(cb);
  }

  function sendCommand(source, command, params, cb) {
    setTimeout(function() {
      cb({});
    }, commandDuration);

    // reset command duration to 0
    setCommandDuration(0);
  }

  return {
    attach: attach,
    detach: detach,
    sendCommand: sendCommand,
    onEvent: onEvent,
    onDetach: onDetach,

    emitEvent: emitEvent,
    emitDetach: emitDetach,
    setCommandDuration: setCommandDuration
  };
}


function tabsApi() {
  let tabs = [{ id: 1 }];

  function setTabs(tabsData) {
    tabs = tabsData;
  }

  function query(queryInfo, cb) {
    setTimeout(() => cb(tabs));
  }

  function remove(tabId, cb) {
    for (let i = 0; i < tabs.length; i++) {
      if (tabs[i].id === tabId) {
        tabs.splice(i, 1);
        break;
      }
    }
    setTimeout(cb);
  }

  return {
    setTabs: setTabs,
    query: query,
    remove: remove
  };
}


function windowsApi() {

  function create(createData, cb) {
    setTimeout(function() {
      cb({
        id: 1,
        tabs: [{ id: 1 }]
      });
    });
  }

  function remove(windowId, cb) {
    setTimeout(cb);
  }

  return {
    create: create,
    remove: remove
  };
}


const originalChromeApi = global.chrome,
  fakeChromeApi = {
    debugger: debuggerApi(),
    runtime: {},
    tabs: tabsApi(),
    windows: windowsApi()
  };


exports.use = function() {
  global.chrome = fakeChromeApi;
};


exports.restore = function() {
  global.chrome = originalChromeApi;
};
