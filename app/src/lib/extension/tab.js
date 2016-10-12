'use strict';


const logging = require('selenium-webdriver/lib/logging'),
  Debugger = require('./debugger'),
  FrameTracker = require('./frame_tracker');


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

  constructor(tabData) {
    this.id_ = tabData.id;

    this.log_ = logging.getLogger('webdriver.extension.Tab');
    this.debugger_ = new Debugger();
    this.frameTracker_ = new FrameTracker(this.debugger_);
    this.navigationTracker_ = null;
  }

  connectIfNecessary() {
    if (this.debugger_.isConnected()) {
      return Promise.resolve();
    } else {
      return this.debugger_.connect(this.id_)
        .then(() => this.frameTracker_.connect(this.debugger_));
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

  load(url) {
    return this.debugger_.sendCommand('Page.navigate', { url: url });
  }

  reload() {
    return this.debugger_.sendCommand('Page.reload', { ignoreCache: false });
  }
}


module.exports = Tab;
