'use strict';


const error = require('selenium-webdriver/lib/error'),
  sessions = require('./session'),
  findSession = sessions.findSession;


function executeWindowOperation(session, op) {
  let tab;

  if (!session) {
    return Promise.reject(new error.NoSuchSessionError());
  }

  try {
    tab = session.getCurrentTab();
  } catch(e) {
    return Promise.reject(e);
  }

  function waitForPendingNavigation() {
    return tab.waitForPendingNavigation(session.getCurrentFrameId(), session.getPageLoadTimeout(), true);
  }

  return tab.connectIfNecessary()
    .then(() => {
      let dialogManager = tab.getJavaScriptDialogManager();

      if(dialogManager.isDialogOpen()) {
        throw(new error.UnexpectedAlertOpenError(undefined, dialogManager.getDialogMessage()));
      }
    })
    .then(waitForPendingNavigation)
    .then(() => op(tab))
    .then(waitForPendingNavigation);
}


/**
 * [Go command](https://www.w3.org/TR/webdriver/#go)
 *
 * @param {!Object<*>} parameters The command parameters.
 */
function go(parameters) {
  let session = findSession(parameters.sessionId);

  return executeWindowOperation(session, tab => tab.load(parameters.url, session.getPageLoadTimeout()));
}


/**
 * [Refresh command](https://www.w3.org/TR/webdriver/#refresh)
 *
 * @param {!Object<*>} parameters The command parameters.
 */
function refresh(parameters) {
  let session = findSession(parameters.sessionId);

  return executeWindowOperation(session, tab => tab.reload(session.getPageLoadTimeout()));
}


module.exports = {
  go: go,
  refresh: refresh
};
