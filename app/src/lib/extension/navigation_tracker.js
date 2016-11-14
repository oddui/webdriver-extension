'use strict';


const  error = require('selenium-webdriver/lib/error'),
  logging = require('selenium-webdriver/lib/logging'),
  get = require('lodash/get');


/**
 * Enum of page load strategy
 */
const PageLoadStrategy = {
  NORMAL: 'normal',
  EAGER: 'eager',
  NONE: 'none'
};


function create(strategy, dialogManager) {
  switch(strategy) {
    case PageLoadStrategy.NONE:
      return new NonBlockingNavigationTracker();
    case PageLoadStrategy.NORMAL:
      return new NavigationTracker(dialogManager);
    default:
      throw new error.WebDriverError(`Page load strategy '${strategy}' is not supported.`);
  }
}


/**
 * Loading state enum
 */
const LoadingState = {
  Unkown: 0,
  Loading: 1,
  NotLoading: 2
};


const DUMMY_FRAME_NAME = 'webdriver-extension dummy frame',
  DUMMY_FRAME_URL = 'about:blank',
  UNREACHABLE_DATA_URL = 'data:text/html,chromewebdata';


class NavigationTrackerInterface {

  constructor() {}

  isPendingNavigation() {}

  setTimedOut() {}
}


/**
 * See chromedriver NonBlockingNavigationTracker
 * https://cs.chromium.org/chromium/src/chrome/test/chromedriver/chrome/non_blocking_navigation_tracker.h
 */
class NonBlockingNavigationTracker extends NavigationTrackerInterface {

  isPendingNavigation() {
    return false;
  }
}


/**
 * See chromedriver NavigationTracker
 * https://cs.chromium.org/chromium/src/chrome/test/chromedriver/chrome/navigation_tracker.h
 */
class NavigationTracker extends NavigationTrackerInterface {

  constructor(dialogManager, knownState) {
    super();

    this.dummyFrameId_ = 0;
    this.dummyExecutionContextId_ = '';
    this.loadingState_ = knownState || LoadingState.Unknown;
    this.pendingFrameSet_ = new Set();
    this.scheduledFrameSet_ = new Set();
    this.executionContextSet_ = new Set();
    this.timedOut_ = false;
    this.loadEventFired_ = false;

    this.debugger_ = null;
    this.dialogManager_ = dialogManager;
    this.log_ = logging.getLogger('webdriver.extension.NavigationTracker');

    this.onExecutionContextCreated_ = this.onExecutionContextCreated_.bind(this);
    this.onExecutionContextDestroyed_ = this.onExecutionContextDestroyed_.bind(this);
    this.onExecutionContextsCleared_ = this.onExecutionContextsCleared_.bind(this);
    this.onFrameClearedScheduledNavigation_ = this.onFrameClearedScheduledNavigation_.bind(this);
    this.onFrameNavigated_ = this.onFrameNavigated_.bind(this);
    this.onFrameScheduledNavigation_ = this.onFrameScheduledNavigation_.bind(this);
    this.onFrameStartedLoading_ = this.onFrameStartedLoading_.bind(this);
    this.onFrameStoppedLoading_ = this.onFrameStoppedLoading_.bind(this);
    this.onLoadEventFired_ = this.onLoadEventFired_.bind(this);
    this.onTargetCrashed_ = this.onTargetCrashed_.bind(this);
    this.onCommandSuccess_ = this.onCommandSuccess_.bind(this);
  }

  connect(dbg) {
    this.debugger_ = dbg;

    this.debugger_.on('Inspector.targetCrashed', this.onTargetCrashed_);
    this.debugger_.on('Page.frameClearedScheduledNavigation', this.onFrameClearedScheduledNavigation_);
    this.debugger_.on('Page.frameNavigated', this.onFrameNavigated_);
    this.debugger_.on('Page.frameScheduledNavigation', this.onFrameScheduledNavigation_);
    this.debugger_.on('Page.frameStartedLoading', this.onFrameStartedLoading_);
    this.debugger_.on('Page.frameStoppedLoading', this.onFrameStoppedLoading_);
    this.debugger_.on('Page.loadEventFired', this.onLoadEventFired_);
    this.debugger_.on('Runtime.executionContextCreated', this.onExecutionContextCreated_);
    this.debugger_.on('Runtime.executionContextDestroyed', this.onExecutionContextDestroyed_);
    this.debugger_.on('Runtime.executionContextsCleared', this.onExecutionContextsCleared_);
    this.debugger_.onCommandSuccess(this.onCommandSuccess_);

    return this.debugger_.sendCommand('Page.enable');
  }

  /**
   * Gets whether a navigation is pending for the specified frame.
   *
   * @param {string} frameId The frame id. May be empty to signify the main frame.
   * @param {number} timeout The timeout for debugger commands.
   * @return {Promise}
   */
  isPendingNavigation(frameId, timeout) {
    let isPending = null,
      BreakSignal = function() {};

    if (this.dialogManager_.isDialogOpen()) {
      // The render process is paused while modal dialogs are open, so
      // Runtime.evaluate will block and time out if we attempt to call it. In
      // this case we can consider the page to have loaded, so that we return
      // control back to the test and let it dismiss the dialog.
      return Promise.resolve(false);
    }

    // Some debugger commands (e.g. Input.dispatchMouseEvent) are handled in the
    // browser process, and may cause the renderer process to start a new
    // navigation. We need to call Runtime.evaluate to force a roundtrip to the
    // renderer process, and make sure that we notice any pending navigations.
    return this.debugger_.sendCommand('Runtime.evaluate', { expression: '1' }, timeout)
      .then(result => {
        if (get(result, 'result.value') !== 1) {
          throw(new error.WebDriverError('Cannot determine loading status.'));
        }
      })
      .catch(e => {
        if (/connect\(\) must be called/i.test(e.message)) {
          // If the debugger is not connected, don't wait for pending navigations
          // to complete, since we won't see any more events from it until we reconnect.
          isPending = false;
          throw new BreakSignal();
        } else if (e instanceof error.UnexpectedAlertOpenError) {
          // Dialogs are open after the command is sent and before it gets processed,
          // return control back to the test and let it dismiss the dialog.
          isPending = false;
          throw new BreakSignal();
        } else {
          throw e;
        }
      })
      .then(() => {
        if (this.loadingState_ === LoadingState.Unknown) {
          // In the case that a http request is sent to server to fetch the page
          // content and the server hasn't responded at all, a dummy page is created
          // for the new window. In such case, the baseURL will be empty.
          return this.debugger_.sendCommand('DOM.getDocument', {}, timeout)
            .then(result => {
              let baseUrl = get(result, 'root.baseURL');
              if (baseUrl === undefined) {
                throw(new error.WebDriverError('Cannot determine loading status.'));
              }
              if (baseUrl === '') {
                this.loadingState_ = LoadingState.Loading;
                isPending = true;
                throw new BreakSignal();
              }
            })
            .then(() => {
              // If the loading state is unknown (which happens after first connecting),
              // force loading to start and set the state to loading. This will cause a
              // frame start event to be received, and the frame stop event will not be
              // received until all frames are loaded.  Loading is forced to start by
              // attaching a temporary iframe. Forcing loading to start is not necessary
              // if the main frame is not yet loaded.
              const FORCE_LOADING = [`(() => {`,
                `let isLoaded = document.readyState === 'complete' || document.readyState === 'interactive';`,
                `if (isLoaded) {`,
                `  let frame = document.createElement('iframe');`,
                `  frame.name = '${DUMMY_FRAME_NAME}';`,
                `  frame.src = '${DUMMY_FRAME_URL}';`,
                `  document.body.appendChild(frame);`,
                `  window.setTimeout(() => document.body.removeChild(frame));`,
                `}`,
              `})();`].join('');

              return this.debugger_.sendCommand('Runtime.evaluate', { expression: FORCE_LOADING }, timeout);
            })
            .then(() => {
              // Between the time the JavaScript is evaluated and the result returns
              // the event listeners may have received info about the loading state.
              // Only set the loading state if the loading state is still unknown.
              if (this.loadingState_ === LoadingState.Unknown) {
                this.loadingState_ = LoadingState.Loading;
              }
            });
        }
      })
      .then(() => {
        isPending = this.loadingState_ === LoadingState.Loading;

        if (frameId) {
          return isPending || this.scheduledFrameSet_.has(frameId) || this.pendingFrameSet_.has(frameId);
        } else {
          return isPending || this.scheduledFrameSet_.size > 0 || this.pendingFrameSet_.size > 0;
        }
      })
      .catch(e => {
        if (e instanceof BreakSignal) {
          return isPending;
        } else {
          throw e;
        }
      });
  }

  setTimedOut(timedOut) {
    this.timedOut_ = timedOut;
  }

  resetLoadingState_(loadingState) {
    this.loadingState_ = loadingState;
    this.pendingFrameSet_.clear();
    this.scheduledFrameSet_.clear();
  }

  getParam_(params, path) {
    let value = get(params, path);

    if (value === undefined) {
      throw new error.WebDriverError(`Missing or invalid parameter: ${path}.`);
    } else {
      return value;
    }
  }

  // Page.frameStartedLoading
  onFrameStartedLoading_(params) {
    let frameId = this.getParam_(params, 'frameId');

    this.pendingFrameSet_.add(frameId);
    this.loadingState_ = LoadingState.Loading;
  }

  // Page.frameStoppedLoading
  onFrameStoppedLoading_(params) {
    let frameId = this.getParam_(params, 'frameId');

    this.pendingFrameSet_.delete(frameId);
    this.scheduledFrameSet_.delete(frameId);

    if (this.pendingFrameSet_.size === 0 &&
        (this.loadEventFired_ || this.timedOut_ || this.executionContextSet_.size === 0)) {
      this.loadingState_ = LoadingState.NotLoading;
    }
  }

  // Page.frameScheduledNavigation
  onFrameScheduledNavigation_(params) {
    let frameId = this.getParam_(params, 'frameId'),
      delay = this.getParam_(params, 'delay');

    // WebDriver spec says to ignore redirects over 1s.
    if (delay <= 1) {
      this.scheduledFrameSet_.add(frameId);
    }
  }

  // Page.frameClearedScheduledNavigation
  onFrameClearedScheduledNavigation_(params) {
    let frameId = this.getParam_(params, 'frameId');

    this.scheduledFrameSet_.delete(frameId);
  }

  // Page.frameNavigated
  onFrameNavigated_(params) {
    // Note: in some cases Page.frameNavigated may be received for subframes
    // without a frameStoppedLoading (for example cnn.com).

    if (!get(params, 'frame.parentId')) {
      // Discard pending and scheduled frames, except for the root frame,
      // which just navigated (and which we should consider pending until we
      // receive a Page.frameStoppedLoading event for it).
      let frameId = this.getParam_(params, 'frame.id'),
        frameWasPending = this.pendingFrameSet_.has(frameId);

      this.pendingFrameSet_.clear();
      this.scheduledFrameSet_.clear();

      if (frameWasPending) {
        this.pendingFrameSet_.add(frameId);
      }

      // If the URL indicates that the web page is unreachable (the sad tab
      // page) then discard all pending navigations.
      if (this.getParam_(params, 'frame.url') === UNREACHABLE_DATA_URL) {
        this.pendingFrameSet_.clear();
      }
    } else {
      // If a child frame just navigated, check if it is the dummy frame that
      // was attached by IsPendingNavigation(). We don't want to track execution
      // contexts created and destroyed for this dummy frame.
      let frameName = this.getParam_(params, 'frame.name'),
        frameUrl = this.getParam_(params, 'frame.url');

      if (frameName === DUMMY_FRAME_NAME && frameUrl === DUMMY_FRAME_URL) {
        this.dummyFrameId_ = this.getParam_(params, 'frame.id');
      }
    }
  }

  // Runtime.executionContextsCleared
  onExecutionContextsCleared_() {
    this.executionContextSet_.clear();
    this.loadEventFired_ = false;

    // As of crrev.com/382211, DevTools sends an executionContextsCleared
    // event right before the first execution context is created, but after
    // Page.loadEventFired. Set the loading state to loading, but do not
    // clear the pending and scheduled frame sets, since they may contain
    // frames that we're still waiting for.
    this.loadingState_ = LoadingState.Loading;
  }

  // Runtime.executionContextCreated
  onExecutionContextCreated_(params) {
    let frameId,
      executionContextId = this.getParam_(params, 'context.id');

    try {
      frameId = this.getParam_(params, 'context.auxData.frameId');
    } catch(e) {
      // TODO: remove this when we stop supporting Chrome 53.
      frameId = this.getParam_(params, 'context.frameId');
    }

    if (frameId === this.dummyFrameId_) {
      this.dummyExecutionContextId_ = executionContextId;
    } else {
      this.executionContextSet_.add(executionContextId);
    }
  }

  // Runtime.executionContextDestroyed
  onExecutionContextDestroyed_(params) {
    let executionContextId = this.getParam_(params, 'executionContextId');

    this.executionContextSet_.delete(executionContextId);
    if (executionContextId !== this.dummyExecutionContextId_ && this.executionContextSet_.size === 0) {
      this.loadingState_ = LoadingState.Loading;
      this.loadEventFired_ = false;
      this.dummyFrameId_ = '';
      this.dummyExecutionContextId_ = 0;
    }
  }

  // Page.loadEventFired
  onLoadEventFired_() {
    this.loadEventFired_ = true;
  }

  // Inspector.targetCrashed
  onTargetCrashed_() {
    this.resetLoadingState_(LoadingState.NotLoading);
  }

  onCommandSuccess_(command) {
    if ((command === 'Page.navigate' || command === 'Page.navigateToHistoryEntry') &&
      this.loadingState_ !== LoadingState.Loading) {

      // At this point the browser has initiated the navigation, but besides that,
      // it is unknown what will happen.
      this.loadingState_ = LoadingState.Unknown;
    }
  }
}


module.exports = {
  PageLoadStrategy: PageLoadStrategy,
  create: create,

  LoadingState: LoadingState,
  NavigationTracker: NavigationTracker,
  NonBlockingNavigationTracker: NonBlockingNavigationTracker
};
