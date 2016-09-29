'use strict';


const error = require('selenium-webdriver/lib/error');


const MAXIMUM_ACTIVE_SESSIONS = 1;


const NEXUS5_EMULATION_METRICS = {
  mobile: true,
  width: 360,
  height: 640,
  deviceScaleFactor: 3,
  fitWindow: false,
  screenOrientation: {
    angle: 0,
    type: 'portraitPrimary'
  }
};


const NEXUS5_USERAGENT =
  'Mozilla/5.0 (Linux; Android 4.4.4; Nexus 5 Build/KTU84P) \
   AppleWebKit/537.36 (KHTML, like Gecko) \
   Chrome/38.0.2125.114 Mobile Safari/537.36';


/**
 * Enum of page load strategy
 */
const PageLoadStrategy = {
  NORMAL: 'normal',
  EAGER: 'eager',
  NONE: 'none'
};


const activeSessions = [];


/**
 * Look up session in session store by id.
 *
 * @param {string} id The session id.
 */
function findSession(id) {
  let found = null;

  activeSessions.forEach(function(session) {
    if (session.getId() === id) {
      found = session;
    }
  });

  return found;
}


function addSession(session) {
  if (session instanceof Session) {
    activeSessions.push(session);
  }
}


function removeSession(id) {
  let session = findSession(id);

  if (session) {
    activeSessions.splice(activeSessions.indexOf(session), 1);
  }
}


function clearActiveSessions() {
  activeSessions.length = 0;
}


class Session {
  constructor() {
    this.id_ = uuid();

    this.currentBrowsingContext_ = null;
    this.currentTopLevelBrowsingContext_ = null;

    this.scriptTimeout_ = 30000;
    this.pageLoadTimeout_ = 300000;
    this.implicitWaitTimeout_ = 0;

    this.pageLoadStrategy_ = PageLoadStrategy.NORMAL;
    this.secureSsl_ = true;
  }

  getId() {
    return this.id_;
  }

  getScriptTimeout() {
    return this.scriptTimeout_;
  }

  setScriptTimeout(timeout) {
    if (typeof timeout !== 'number') {
      throw(
        new error.WebDriverError('Script timeout must be a number.')
      );
    }

    this.scriptTimeout_ = timeout;
    return this;
  }

  getPageLoadTimeout() {
    return this.pageLoadTimeout_;
  }

  setPageLoadTimeout(timeout) {
    if (typeof timeout !== 'number') {
      throw(
        new error.WebDriverError('Page load timeout must be a number.')
      );
    }

    this.pageLoadTimeout_ = timeout;
    return this;
  }

  getImplicitWaitTimeout() {
    return this.implicitWaitTimeout_;
  }

  setImplicitWaitTimeout(timeout) {
    if (typeof timeout !== 'number') {
      throw(
        new error.WebDriverError('Implicit wait timeout must be a number.')
      );
    }

    this.implicitWaitTimeout_ = timeout;
    return this;
  }

  getPageLoadStrategy() {
    return this.pageLoadStrategy_;
  }

  setPageLoadStrategy(strategy) {
    if (typeof strategy !== 'string') {
      throw(
        new error.WebDriverError('Page load strategy must be a string.')
      );
    }

    if (strategy === PageLoadStrategy.NORMAL ||
      strategy === PageLoadStrategy.EAGER ||
      strategy === PageLoadStrategy.NONE) {

      this.pageLoadStrategy_ = strategy;
      return this;
    }

    throw(
      new error.WebDriverError(
        `Page load strategy '${strategy}' is not supported.`
      )
    );
  }

  getSecureSsl() {
    return this.secureSsl_;
  }

  acceptSslCerts(accept) {
    this.secureSsl_ = !accept;
    return this;
  }
}


// RFC4122 version 4 compliant UUID, see http://stackoverflow.com/a/2117523
function uuid() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    let r = Math.random()*16|0, v = c == 'x' ? r : (r&0x3|0x8);
    return v.toString(16);
  });
}


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
    }, function(window) {
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
    chrome.windows.remove(windowId, function() {
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
 * @param {!Debugger} dbg
 */
function newSession(parameters, dbg) {

  if (activeSessions.length >= MAXIMUM_ACTIVE_SESSIONS) {
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
  activeSessions.push(session);

  if (capsResult.pageLoadStrategy) {
    session.setPageLoadStrategy(capsResult.pageLoadStrategy);
  }

  return createWindow()
    .then(function(window) {
      let chromeOptions = capsResult.chromeOptions || {};

      if (chromeOptions.mobileEmulation) {
        return dbg.connect(window.tabs[0])
          .then(function() {
            return Promise.all([
              dbg.sendCommand('Emulation.setDeviceMetricsOverride', NEXUS5_EMULATION_METRICS),
              // Network.enable must be called for UA overriding to work
              dbg.sendCommand('Network.enable'),
              dbg.sendCommand('Network.setUserAgentOverride', { userAgent: NEXUS5_USERAGENT }),
              dbg.sendCommand('Emulation.setTouchEmulationEnabled', {
                enabled: true,
                configuration: 'mobile'
              })
            ]);
          });
      }
    })
    .then(function() {
      return {
        sessionId: session.getId(),
        capabilities: capsResult
      };
    })
    .catch(function(e) {
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
  console.info(parameters);
  // TODO: close session windows

  removeSession(parameters.sessionId);

  return Promise.resolve();
}


module.exports = {
  MAXIMUM_ACTIVE_SESSIONS: MAXIMUM_ACTIVE_SESSIONS,
  PageLoadStrategy: PageLoadStrategy,
  Session: Session,
  findSession: findSession,
  addSession: addSession,
  removeSession: removeSession,
  clearActiveSessions: clearActiveSessions,

  // session commands
  newSession: newSession,
  deleteSession: deleteSession
};
