'use strict';


const error = require('selenium-webdriver/lib/error'),
  {
    addSession,
    findSession,
    removeSession,
    Session,
    reachedMaximumActiveSessions,
    MAXIMUM_ACTIVE_SESSIONS
  } = require('./session');


let Debugger = null;


function processCapabilities(caps) {
  let desiredCaps = caps.desiredCapabilities || {},
    requiredCaps = caps.requiredCapabilities || {},
    unprocessedCaps = Object.assign({}, desiredCaps, requiredCaps),
    serverCaps = {
      browserName: 'chrome',
      browserVersion: '',
      platformName: '',
      platformVersion: '',
      acceptSslCerts: false
    },
    unmetCaps = [];

  for (let cap in unprocessedCaps) {
    let value = unprocessedCaps[cap];

    if (requiredCaps[cap] !== undefined &&
      serverCaps[cap] !== undefined &&
      value !== serverCaps[cap]) {

      unmetCaps.push(
        `Required capability ${cap} ${value} does not match server capability ${serverCaps[cap]}`
      );
      continue;
    }

    if (['proxy', 'pageLoadStrategy', 'chromeOptions'].indexOf(cap) > -1) {
      serverCaps[cap] = unprocessedCaps[cap];
    } else if (requiredCaps[cap] !== undefined) {
      unmetCaps.push(
        `Unknown required capability ${cap} ${value}`
      );
    }
  }

  if (unmetCaps.length) {
    throw(new error.SessionNotCreatedError(unmetCaps.join(';')));
  }

  return serverCaps;
}


/**
 * [New Session command](https://www.w3.org/TR/webdriver/#new-session)
 *
 * @param {!Object<*>} parameters The command parameters.
 */
function newSession(parameters) {

  if (reachedMaximumActiveSessions()) {
    return Promise.reject(
      new error.SessionNotCreatedError(
        `Maximum(${MAXIMUM_ACTIVE_SESSIONS}) active sessions reached.`
      )
    );
  }

  if (typeof parameters !== 'object') {
    return Promise.reject(
      new error.SessionNotCreatedError('Cannot find desiredCapabilities.')
    );
  }

  let capsResult;

  try {
    if (parameters.capabilities && parameters.capabilities.desiredCapabilities) {
      capsResult = processCapabilities(parameters.capabilities);
    } else if (parameters.desiredCapabilities) {
      capsResult = processCapabilities({ desiredCapabilities: parameters.desiredCapabilities });
    } else {
      throw(new error.SessionNotCreatedError('Cannot find desiredCapabilities.'));
    }
  } catch(e) {
    return Promise.reject(e);
  }

  let session = new Session();

  addSession(session);

  if (capsResult.pageLoadStrategy) {
    session.setPageLoadStrategy(capsResult.pageLoadStrategy);
  }

  return session.trackTabs(Debugger.list, Debugger.new)
    .then(() => {
      let tab = session.getFirstTab(),
        chromeOptions = capsResult.chromeOptions || {};

      session.setCurrentTabId(tab.id);

      if (chromeOptions.mobileEmulation) {
        return tab.setMobileEmulationOverride();
      }
    })
    .then(() => {
      return {
        sessionId: session.getId(),
        capabilities: capsResult
      };
    })
    .catch(e => {
      removeSession(session.getId());
      throw new error.SessionNotCreatedError(e.message);
    });
}


/**
 * [Delete Session command](https://www.w3.org/TR/webdriver/#delete-session)
 *
 * @param {!Object<*>} parameters The command parameters.
 */
function deleteSession(parameters) {
  let session = findSession(parameters.sessionId);

  if (!session) {
    return Promise.reject(new error.NoSuchSessionError());
  }

  return Debugger.close(session.getTabIds())
    .then(() => removeSession(parameters.sessionId))
    .catch(e => {
      throw new error.WebDriverError(e.message);
    });
}


module.exports = {
  newSession: newSession,
  deleteSession: deleteSession,

  set Debugger (value) {
    Debugger = value;
  }
};
