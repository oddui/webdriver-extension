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

    this.tabs_ = [];
    this.currentTabId_ = null;

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

  /**
   * Keep track of tabs. Obtain the set of tab handles before the interaction
   * is performed and compare it with the set after the action is performed.
   *
   * @param {!function} list Function to return a promise that resolves all browser tabs
   * @param {!function} interaction The interaction to perform
   */
  trackTabs(list, interaction) {
    let tabsBefore, tabsAfter;

    return list()
      .then(tabs => tabsBefore = tabs)
      .then(() => interaction())
      .then(() => list())
      .then(tabs => tabsAfter = tabs)
      .then(() => {
        let tabIdsBefore, tabIdsAfter;

        tabIdsBefore = tabsBefore.map(tab => tab.id);
        tabIdsAfter = tabsAfter.map(tab => tab.id);

        // untrack closed tabs
        tabsBefore
          .filter(tab => tabIdsAfter.indexOf(tab.id) === -1)
          .forEach(closedTab => {
            let trackedAt = this.tabs_.findIndex(tab => tab.getId() === closedTab.id);

            if (trackedAt !== -1) {
              this.tabs_.splice(trackedAt, 1);
            }
          });

        // track newly-opened tabs
        tabsAfter
          .filter(tab => tabIdsBefore.indexOf(tab.id) === -1)
          .forEach(tabData => {
            let tab = new Tab(tabData, this.pageLoadStrategy_);
            this.tabs_.push(tab);
          });
      });
  }

  getTabIds() {
    return this.tabs_.map(tab => tab.getId());
  }

  getFirstTab() {
    return this.tabs_[0];
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

  setCurrentTabId(id) {
    this.currentTabId_ = id;
  }

  getCurrentTab() {
    let tab = this.getTabById(this.currentTabId_);

    if (tab) {
      return tab;
    } else {
      throw new error.NoSuchWindowError('Window already closed.');
    }
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
