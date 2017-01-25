'use strict';


const logging = require('selenium-webdriver/lib/logging'),
  error = require('selenium-webdriver/lib/error'),
  promise = require('selenium-webdriver/lib/promise'),
  Debugger = require('./debugger'),
  FrameTracker = require('./frame_tracker'),
  JavaScriptDialogManager = require('./javascript_dialog_manager'),
  navigationTrackers = require('./navigation_tracker');


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
 * Chrome browser tab
 *
 * See chromedriver WebViewImpl
 * https://cs.chromium.org/chromium/src/chrome/test/chromedriver/chrome/web_view_impl.cc
 */
class Tab {

  constructor(tabData, pageLoadStrategy) {
    this.id_ = tabData.id;

    this.log_ = logging.getLogger('webdriver.extension.Tab');
    this.debugger_ = new Debugger();
    this.frameTracker_ = new FrameTracker();
    this.dialogManager_ = new JavaScriptDialogManager();
    this.navigationTracker_ = navigationTrackers.create(pageLoadStrategy, this.dialogManager_);
  }

  getId() {
    return this.id_;
  }

  getJavaScriptDialogManager() {
    return this.dialogManager_;
  }

  connectIfNecessary() {
    if (this.debugger_.isConnected()) {
      return Promise.resolve();
    } else {
      return this.debugger_.connect(this.id_)
        .then(() => this.frameTracker_.connect(this.debugger_))
        .then(() => this.dialogManager_.connect(this.debugger_))
        .then(() => this.navigationTracker_.connect(this.debugger_));
    }
  }

  getContextIdForFrame(frameId) {
    return this.frameTracker_.getContextIdForFrame(frameId);
  }

  setMobileEmulationOverride() {
    return Promise.all([
      this.debugger_.sendCommand('Emulation.setDeviceMetricsOverride', NEXUS5_EMULATION_METRICS),
      // Network.enable must be called for UA overriding to work
      this.debugger_.sendCommand('Network.enable'),
      this.debugger_.sendCommand('Network.setUserAgentOverride', { userAgent: NEXUS5_USERAGENT }),
      this.debugger_.sendCommand('Emulation.setTouchEmulationEnabled', {
        enabled: true,
        configuration: 'mobile'
      })
    ]);
  }

  isPendingNavigation(frameId) {
    return this.navigationTracker_.isPendingNavigation(frameId);
  }

  isNotPendingNavigation(frameId) {
    return this.isPendingNavigation(frameId)
      .then(pending => !pending);
  }

  waitForPendingNavigation(frameId, timeout, stopLoadOnTimeout) {
    this.log_.finer('Waiting for pending navigations...');

    return promise.controlFlow()
      .wait(() => this.isNotPendingNavigation(), timeout, 'Waiting for pending navigations timed out.')
      .catch(e => {
        if (e instanceof error.TimeoutError && stopLoadOnTimeout) {
          this.log_.finer('Timed out. Stopping navigation...');
          // TODO: stop navigation
        }
        throw e;
      })
      .then(() => this.log_.finer('Done waiting for pending navigations.'));
  }

  load(url, timeout) {
    return this.debugger_.sendCommand('Page.navigate', { url: url }, timeout);
  }

  reload(timeout) {
    return this.debugger_.sendCommand('Page.reload', { ignoreCache: false }, timeout);
  }
}


module.exports = Tab;
