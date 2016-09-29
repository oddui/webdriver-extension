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


function windowsApi() {

  function create(createData, cb) {
    setTimeout(function() {
      cb({
        id: 1,
        tabs: [{ id: 1 }]
      });
    });
  }

  return {
    create: create
  };
}


let originalChromeApi = null;


exports.use = function() {
  originalChromeApi = global.chrome;

  global.chrome = {
    debugger: debuggerApi(),
    runtime: {},
    windows: windowsApi()
  };
};


exports.restore = function() {
  global.chrome = originalChromeApi;
};