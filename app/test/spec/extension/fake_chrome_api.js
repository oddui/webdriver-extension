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
    onDetach = new EventEmitter();

  function emitEvent(method, params) {
    onEvent.emit({}, method, params);
  }

  function emitDetach(detachReason) {
    onDetach.emit({}, detachReason);
  }

  function attach(debuggee, version, cb) {
    setTimeout(cb);
  }

  function detach(debuggee, cb) {
    setTimeout(cb);
  }

  function sendCommand(debuggee, command, params, cb) {
    setTimeout(function() {
      cb({});
    });
  }

  return {
    attach: attach,
    detach: detach,
    sendCommand: sendCommand,
    onEvent: onEvent,
    onDetach: onDetach,

    emitEvent: emitEvent,
    emitDetach: emitDetach
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


let originalChromeApi = null;


exports.use = function() {
  originalChromeApi = global.chrome;

  global.chrome = {
    debugger: debuggerApi(),
    runtime: {},
    tabs: tabsApi(),
    windows: windowsApi()
  };
};


exports.restore = function() {
  global.chrome = originalChromeApi;
};
