'use strict';


const error = require('selenium-webdriver/lib/error'),
  logging = require('selenium-webdriver/lib/logging');


/**
 * Track frames
 *
 * See chromedriver FrameTracker
 * https://cs.chromium.org/chromium/src/chrome/test/chromedriver/chrome/frame_tracker.h
 */
class FrameTracker {

  constructor() {
    this.debugger_ = null;
    this.log_ = logging.getLogger('webdriver.extension.FrameTracker');
    this.frameToContextMap_ = new Map();

    this.onExecutionContextCreated_ = this.onExecutionContextCreated_.bind(this);
    this.onExecutionContextDestroyed_ = this.onExecutionContextDestroyed_.bind(this);
    this.onExecutionContextsCleared_ = this.onExecutionContextsCleared_.bind(this);
    this.onFrameNavigated_ = this.onFrameNavigated_.bind(this);
  }

  onExecutionContextCreated_(params) {
    let context = params.context;

    if (!context) {
      throw new error.WebDriverError('Runtime.executionContextCreated parameters missing context.');
    }

    if (!context.id) {
      throw new error.WebDriverError('Runtime.executionContextCreated has invalid context');
    }

    let isDefault, frameId;

    if (context.auxData) {
      isDefault = context.auxData.isDefault;
      frameId = context.auxData.frameId;
    }

    // TODO: remove this when we stop supporting Chrome 53.
    if (context.isDefault) {
      isDefault = context.isDefault;
    }

    // TODO: remove this when we stop supporting Chrome 53.
    if (context.frameId) {
      frameId = context.frameId;
    }

    if (isDefault && frameId) {
      this.log_.finest(`tab ${this.debugger_.getTabId()} add frame tracking: ${frameId} -> ${context.id}`);
      this.frameToContextMap_.set(frameId, context.id);
    }
  }

  onExecutionContextDestroyed_(params) {
    let executionContextId = params.executionContextId;

    if (!executionContextId) {
      throw new error.WebDriverError('Runtime.executionContextDestroyed parameters missing executionContextId.');
    }

    for (let entry of this.frameToContextMap_) {
      if (entry[1] === executionContextId) {
        this.log_.finest(`tab ${this.debugger_.getTabId()} remove frame tracking: ${entry[0]}`);
        this.frameToContextMap_.delete(entry[0]);
        break;
      }
    }
  }

  onExecutionContextsCleared_() {
    this.frameToContextMap_.clear();
  }

  onFrameNavigated_(params) {
    if (!params.frame.parentId) {
      this.frameToContextMap_.clear();
    }
  }

  /**
   * Add listners to debugger and start tracking frames for the debuggee
   *
   * @param {Debugger} dbg
   */
  connect(dbg) {
    this.debugger_ = dbg;
    this.frameToContextMap_.clear();

    this.debugger_.on('Runtime.executionContextCreated', this.onExecutionContextCreated_);
    this.debugger_.on('Runtime.executionContextDestroyed', this.onExecutionContextDestroyed_);
    this.debugger_.on('Runtime.executionContextsCleared', this.onExecutionContextsCleared_);
    this.debugger_.on('Page.frameNavigated', this.onFrameNavigated_);

    // Enable runtime events to allow tracking execution context creation.
    return Promise.all([
      this.debugger_.sendCommand('Runtime.enable'),
      this.debugger_.sendCommand('Page.enable')
    ]);
  }

  getContextIdForFrame(frameId) {
    let contextId = this.frameToContextMap_.get(frameId);

    if (contextId) {
      return contextId;
    } else {
      throw new error.WebDriverError('Frame does not have execution context.');
    }
  }
}


module.exports = FrameTracker;
