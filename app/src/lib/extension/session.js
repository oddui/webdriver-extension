'use strict';


const error = require('selenium-webdriver/lib/error'),
  navigationTrackers = require('./navigation_tracker'),
  PageLoadStrategy = navigationTrackers.PageLoadStrategy,
  Tab = require('./tab');


const MAXIMUM_ACTIVE_SESSIONS = 1;


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


function reachedMaximumActiveSessions() {
  return activeSessions.length >= MAXIMUM_ACTIVE_SESSIONS;
}


function addSession(session) {
  if (session instanceof Session && !reachedMaximumActiveSessions()) {
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
    this.targetTabId_ = null;

    /**
     * List of frames for each frame to the current target frame from the
     * top frame. If target frame is window.top, this list will be empty.
     */
    this.frames = [];
  }

  getId() {
    return this.id_;
  }

  getScriptTimeout() {
    return this.scriptTimeout_;
  }

  setScriptTimeout(timeout) {
    if (typeof timeout !== 'number') {
      throw new error.WebDriverError('Script timeout must be a number.');
    }

    this.scriptTimeout_ = timeout;
    return this;
  }

  getPageLoadTimeout() {
    return this.pageLoadTimeout_;
  }

  setPageLoadTimeout(timeout) {
    if (typeof timeout !== 'number') {
      throw new error.WebDriverError('Page load timeout must be a number.');
    }

    this.pageLoadTimeout_ = timeout;
    return this;
  }

  getImplicitWaitTimeout() {
    return this.implicitWaitTimeout_;
  }

  setImplicitWaitTimeout(timeout) {
    if (typeof timeout !== 'number') {
      throw new error.WebDriverError('Implicit wait timeout must be a number.');
    }

    this.implicitWaitTimeout_ = timeout;
    return this;
  }

  getPageLoadStrategy() {
    return this.pageLoadStrategy_;
  }

  setPageLoadStrategy(strategy) {
    if (typeof strategy !== 'string') {
      throw new error.WebDriverError('Page load strategy must be a string.');
    }

    this.pageLoadStrategy_ = strategy;
    return this;
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

  updateTabs_() {
    return new Promise((resolve, reject) => {
      chrome.tabs.query({ windowId: this.windowId_ }, tabs => {
        if (chrome.runtime.lastError) {
          return reject(new error.WebDriverError(chrome.runtime.lastError.message));
        } else {
          resolve(tabs);
        }
      });
    })
      .then(tabs => {
        // check and remove closed tabs
        for (let i = this.tabs_.length-1; i >= 0; i--) {
          let tab = this.tabs_[i],
            closed = tabs.every(tabData => tabData.id !== tab.getId());

          if (closed) {
            this.tabs_.splice(i, 1);
          }
        }

        // check and add newly-opened tabs
        return Promise.all(
          tabs.map(tabData => {
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
    return this.updateTabs_()
      .then(() => {
        return this.tabs_.map(tab => tab.getId());
      });
  }

  getFirstTabId() {
    return this.updateTabs_()
      .then(() => this.tabs_[0].getId());
  }

  getTabById(id) {
    let found = null;

    this.tabs_.forEach(tab => {
      if (tab.getId() === id) {
        found = tab;
      }
    });

    return found;
  }

  setTargetTabId(id) {
    this.targetTabId_ = id;
  }

  getTargetTab() {
    let tab = this.getTabById(this.targetTabId_);

    if (tab) {
      return tab;
    } else {
      throw new error.NoSuchWindowError('Target window already closed.');
    }
  }

  closeTab(id) {
    return new Promise((resolve, reject) => {
      chrome.tabs.remove(id, () => {
        if (chrome.runtime.lastError) {
          return reject(new error.WebDriverError(chrome.runtime.lastError.message));
        } else {
          resolve();
        }
      });
    })
      .then(() => {
        for (let i = this.tabs_.length-1; i >= 0; i--) {
          if (this.tabs_[i].getId() === id) {
            this.tabs_.splice(i, 1);
            break;
          }
        }
      });
  }

  switchToTopFrame() {
    this.frames.length = 0;
  }

  switchToParentFrame() {
    if (this.frames.length) {
      this.frames.pop();
    }
  }

  switchToSubFrame(frameId, webdriverFrameId) {
    let parentFrameId = '',
      framesLength = this.frames.length;

    if (framesLength) {
      parentFrameId = this.frames[framesLength - 1].frameId;
    }
    this.frames.push(new FrameInfo(parentFrameId, frameId, webdriverFrameId));
  }

  getCurrentFrameId() {
    let framesLength = this.frames.length;

    if (framesLength) {
      return this.frames[framesLength - 1].frameId;
    } else {
      return '';
    }
  }
}


class FrameInfo {
  constructor(parentFrameId, frameId, webdriverFrameId) {
    this.parentFrameId = parentFrameId;
    this.frameId = frameId;
    this.webdriverFrameId = webdriverFrameId;
  }
}


// RFC4122 version 4 compliant UUID, see http://stackoverflow.com/a/2117523
function uuid() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    let r = Math.random()*16|0, v = c == 'x' ? r : (r&0x3|0x8);
    return v.toString(16);
  });
}


module.exports = {
  PageLoadStrategy: PageLoadStrategy,
  MAXIMUM_ACTIVE_SESSIONS: MAXIMUM_ACTIVE_SESSIONS,
  reachedMaximumActiveSessions: reachedMaximumActiveSessions,
  Session: Session,
  findSession: findSession,
  addSession: addSession,
  removeSession: removeSession,
  clearActiveSessions: clearActiveSessions,
  FrameInfo: FrameInfo
};
