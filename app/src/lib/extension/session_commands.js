'use strict';


const error = require('selenium-webdriver/lib/error'),
  Tab = require('./tab');


const MAXIMUM_ACTIVE_SESSIONS = 1;


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

    this.windowId_ = null;
    this.tabs_ = [];
    this.currentTabId_ = null;

    /**
     * List of frames for each frame to the current target frame from the
     * top frame. If target frame is window.top, this list will be empty.
     */
    this.frames_ = [];
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

  getWindowId() {
    return this.windowId_;
  }

  setWindowId(windowId) {
    this.windowId_ = windowId;
    return this;
  }

  updateTabs(tabsData) {
    if (!tabsData) {
      // TODO: request this.windowId_ tabs
      tabsData = Promise.resolve([]);
    }

    return Promise.resolve(tabsData)
      .then(data => {

        // TODO: check if some tabs are closed

        // check for newly-opened tabs
        Promise.all(
          data.map(tabData => {
            if (!this.getTabById(tabData.id)) {
              let tab = new Tab(tabData);
              this.tabs_.push(tab);

              return tab.connectIfNecessary();
            } else {
              return Promise.resolve();
            }
          })
        );
      });
  }

  getTabIds() {
  }

  getTabById(id) {
    let found = null;

    this.tabs_.forEach(tab => {
      if (tab.id === id) {
        found = tab;
      }
    });

    return found;
  }

  getCurrentTab() {
    let tab = this.getTabById(this.currentTabId_);
    return tab || this.tabs_[0];
  }

  switchToTopFrame() {
  }

  switchToParentFrame() {
  }

  switchToSubFrame() {
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
 */
function newSession(parameters) {

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
      session.setWindowId(window.id);

      session.updateTabs(window.tabs)
        .then(function() {
          let tab = session.getCurrentTab(),
            chromeOptions = capsResult.chromeOptions || {};

          if (chromeOptions.mobileEmulation) {
            return tab.setMobileEmulationOverride();
          }
        });
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
  let session = findSession(parameters.sessionId);

  if (!session) {
    return Promise.reject(new error.NoSuchSessionError());
  }

  return removeWindow(session.getWindowId())
    .then(() => removeSession(parameters.sessionId));
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
