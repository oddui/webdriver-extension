'use strict';

const cmd = require('selenium-webdriver/lib/command'),
  error = require('selenium-webdriver/lib/error'),
  logging = require('selenium-webdriver/lib/logging'),
  Session = require('selenium-webdriver/lib/session').Session,
  SessionCommands = require('./session_commands'),
  WindowCommands = require('./window_commands');


/** @const {!Map<string, function>} */
const COMMAND_MAP = new Map([
  [cmd.Name.GET_SERVER_STATUS, noop],
  [cmd.Name.NEW_SESSION, SessionCommands.newSession],
  [cmd.Name.GET_SESSIONS, noop],
  [cmd.Name.DESCRIBE_SESSION, noop],
  [cmd.Name.QUIT, SessionCommands.deleteSession],
  [cmd.Name.CLOSE, noop],
  [cmd.Name.GET_CURRENT_WINDOW_HANDLE, noop],
  [cmd.Name.GET_WINDOW_HANDLES, noop],
  [cmd.Name.GET_CURRENT_URL, noop],
  [cmd.Name.GET, WindowCommands.go],
  [cmd.Name.GO_BACK, noop],
  [cmd.Name.GO_FORWARD, noop],
  [cmd.Name.REFRESH, WindowCommands.refresh],
  [cmd.Name.ADD_COOKIE, noop],
  [cmd.Name.GET_ALL_COOKIES, noop],
  [cmd.Name.DELETE_ALL_COOKIES, noop],
  [cmd.Name.DELETE_COOKIE, noop],
  [cmd.Name.FIND_ELEMENT, noop],
  [cmd.Name.FIND_ELEMENTS, noop],
  [cmd.Name.GET_ACTIVE_ELEMENT, noop],
  [cmd.Name.FIND_CHILD_ELEMENT, noop],
  [cmd.Name.FIND_CHILD_ELEMENTS, noop],
  [cmd.Name.CLEAR_ELEMENT, noop],
  [cmd.Name.CLICK_ELEMENT, noop],
  [cmd.Name.SEND_KEYS_TO_ELEMENT, noop],
  [cmd.Name.SUBMIT_ELEMENT, noop],
  [cmd.Name.GET_ELEMENT_TEXT, noop],
  [cmd.Name.GET_ELEMENT_TAG_NAME, noop],
  [cmd.Name.IS_ELEMENT_SELECTED, noop],
  [cmd.Name.IS_ELEMENT_ENABLED, noop],
  [cmd.Name.IS_ELEMENT_DISPLAYED, noop],
  [cmd.Name.GET_ELEMENT_LOCATION, noop],
  [cmd.Name.GET_ELEMENT_SIZE, noop],
  [cmd.Name.GET_ELEMENT_ATTRIBUTE, noop],
  [cmd.Name.GET_ELEMENT_VALUE_OF_CSS_PROPERTY, noop],
  [cmd.Name.ELEMENT_EQUALS, noop],
  [cmd.Name.TAKE_ELEMENT_SCREENSHOT, noop],
  [cmd.Name.SWITCH_TO_WINDOW, noop],
  [cmd.Name.MAXIMIZE_WINDOW, noop],
  [cmd.Name.GET_WINDOW_POSITION, noop],
  [cmd.Name.SET_WINDOW_POSITION, noop],
  [cmd.Name.GET_WINDOW_SIZE, noop],
  [cmd.Name.SET_WINDOW_SIZE, noop],
  [cmd.Name.SWITCH_TO_FRAME, noop],
  [cmd.Name.GET_PAGE_SOURCE, noop],
  [cmd.Name.GET_TITLE, noop],
  [cmd.Name.EXECUTE_SCRIPT, noop],
  [cmd.Name.EXECUTE_ASYNC_SCRIPT, noop],
  [cmd.Name.SCREENSHOT, noop],
  [cmd.Name.SET_TIMEOUT, noop],
  [cmd.Name.MOVE_TO, noop],
  [cmd.Name.CLICK, noop],
  [cmd.Name.DOUBLE_CLICK, noop],
  [cmd.Name.MOUSE_DOWN, noop],
  [cmd.Name.MOUSE_UP, noop],
  [cmd.Name.MOVE_TO, noop],
  [cmd.Name.SEND_KEYS_TO_ACTIVE_ELEMENT, noop],
  [cmd.Name.TOUCH_SINGLE_TAP, noop],
  [cmd.Name.TOUCH_DOUBLE_TAP, noop],
  [cmd.Name.TOUCH_DOWN, noop],
  [cmd.Name.TOUCH_UP, noop],
  [cmd.Name.TOUCH_MOVE, noop],
  [cmd.Name.TOUCH_SCROLL, noop],
  [cmd.Name.TOUCH_LONG_PRESS, noop],
  [cmd.Name.TOUCH_FLICK, noop],
  [cmd.Name.ACCEPT_ALERT, noop],
  [cmd.Name.DISMISS_ALERT, noop],
  [cmd.Name.GET_ALERT_TEXT, noop],
  [cmd.Name.SET_ALERT_TEXT, noop],
  [cmd.Name.SET_ALERT_CREDENTIALS, noop],
  [cmd.Name.GET_LOG, noop],
  [cmd.Name.GET_AVAILABLE_LOG_TYPES, noop],
  [cmd.Name.GET_SESSION_LOGS, noop],
  [cmd.Name.UPLOAD_FILE, noop]
]);


function noop() {
  return Promise.reject(
    new error.UnsupportedOperationError('Command not implemented.')
  );
}

function commandToString(command) {
  let ret = [command.getName(), ''],
    parameters = command.getParameters();

  for (let name in parameters) {
    ret.push(`${name}: ${JSON.stringify(parameters[name])}`);
  }
  return ret.join('\n');
}

function responseToString(res) {
  let ret = [];

  for (let prop in res) {
    ret.push(`${prop}: ${JSON.stringify(res[prop])}`);
  }
  return ret.join('\n');
}


/**
 * A command executor that communicates with Chrome using `chrome.debugger`
 * extension API.
 *
 * @implements {cmd.Executor}
 */
class Executor {
  constructor() {

    /** @private {Map<string, {method: string, path: string}>} */
    this.customCommands_ = new Map();

    /** @private {!logging.Logger} */
    this.log_ = logging.getLogger('webdriver.extension.Executor');
  }

  /**
   * This function is a no-op at this stage, custom commands may be supported
   * later.
   */
  defineCommand() {}

  /** @override */
  execute(command) {
    let op =
      this.customCommands_.get(command.getName())
      || COMMAND_MAP.get(command.getName());

    if (!op) {
      throw new error.UnknownCommandError(
        `Unrecognized command: ${command.getName()}`
      );
    }

    this.log_.finer(() => '>>>\n' + commandToString(command));

    return op(command.getParameters()).then(res => {

      this.log_.finer(() => '<<<\n' + responseToString(res));

      if (command.getName() === cmd.Name.NEW_SESSION) {
        return new Session(res.sessionId, res.capabilities);
      }

      if (res && typeof res === 'object' && 'value' in res) {
        let value = res.value;
        return value === undefined ? null : value;
      }

      return res;
    })
      .catch(e => {
        this.log_.severe(`operation rejected with ${e.toString()}`);
        throw e;
      });
  }
}


module.exports = {
  Executor: Executor
};
