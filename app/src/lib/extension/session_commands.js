'use strict';


const error = require('selenium-webdriver/lib/error');


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


function clearSessions() {
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

  return new Promise((resolve, reject) => {
    chrome.windows.create({
      url: 'data:,'
    }, function(window) {
      if (chrome.runtime.lastError) {
        return reject(
          new error.WebDriverError(chrome.runtime.lastError.message)
        );
      } else {
        if (window) {
          let session = new Session();
          activeSessions.push(session);

          resolve({
            sessionId: session.getId(),
            capabilities: parameters
          });
        } else {
          reject(new error.SessionNotCreatedError('Failed to create window.'));
        }
      }
    });
  });
}


module.exports = {
  MAXIMUM_ACTIVE_SESSIONS: MAXIMUM_ACTIVE_SESSIONS,
  PageLoadStrategy: PageLoadStrategy,
  Session: Session,
  findSession: findSession,
  clearSessions: clearSessions,

  // session commands
  newSession: newSession
};
