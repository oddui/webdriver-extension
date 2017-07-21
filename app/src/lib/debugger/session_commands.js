'use strict';


const error = require('selenium-webdriver/lib/error'),
  sessions = require('./session'),
  addSession = sessions.addSession,
  findSession = sessions.findSession,
  removeSession = sessions.removeSession;


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


function createWindow() {
  return new Promise((resolve, reject) => {
    chrome.windows.create({
      url: 'about:blank'
    }, window => {
      if (chrome.runtime.lastError) {
        return reject(
          new error.WebDriverError(chrome.runtime.lastError.message)
        );
      } else {
        if (window) {
          resolve(window);
        } else {
          reject(new error.SessionNotCreatedError('Failed to create window.'));
        }
      }
    });
  });
}


function removeWindow(windowId) {
  return new Promise((resolve, reject) => {
    chrome.windows.remove(windowId, () => {
      if (chrome.runtime.lastError) {
        return reject(
          new error.WebDriverError(chrome.runtime.lastError.message)
        );
      } else {
        resolve();
      }
    });
  });
}


/**
 * [New Session command](https://www.w3.org/TR/webdriver/#new-session)
 *
 * @param {!Object<*>} parameters The command parameters.
 */
function newSession(parameters) {

  if (sessions.reachedMaximumActiveSessions()) {
    return Promise.reject(
      new error.SessionNotCreatedError(
        `Maximum(${sessions.MAXIMUM_ACTIVE_SESSIONS}) active sessions reached.`
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

  let session = new sessions.Session();

  addSession(session);

  if (capsResult.pageLoadStrategy) {
    session.setPageLoadStrategy(capsResult.pageLoadStrategy);
  }

  return createWindow()
    .then(window => {
      session.setWindowId(window.id);

      return session.getFirstTabId()
        .then(id => session.setTargetTabId(id))
        .then(() => {
          let tab = session.getTargetTab(),
            chromeOptions = capsResult.chromeOptions || {};

          if (chromeOptions.mobileEmulation) {
            return tab.setMobileEmulationOverride();
          }
        });
    })
    .then(() => {
      return {
        sessionId: session.getId(),
        capabilities: capsResult
      };
    })
    .catch((e) => {
      removeSession(session.getId());
      throw(e);
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

  return removeWindow(session.getWindowId())
    .then(() => removeSession(parameters.sessionId));
}


module.exports = {
  newSession: newSession,
  deleteSession: deleteSession
};
