'use strict';


const error = require('selenium-webdriver/lib/error'),
  logging = require('selenium-webdriver/lib/logging'),
  get = require('lodash/get');


/**
 * Track frames
 *
 * See chromedriver FrameTracker
 * https://cs.chromium.org/chromium/src/chrome/test/chromedriver/chrome/frame_tracker.h
 */
class FrameTracker {

  constructor() {
    this.debugger_ = null;
    this.log_ = logging.getLogger('webdriver.debugger.FrameTracker');
    this.frameToContextMap_ = new Map();

    this.onExecutionContextCreated_ = this.onExecutionContextCreated_.bind(this);
    this.onExecutionContextDestroyed_ = this.onExecutionContextDestroyed_.bind(this);
    this.onExecutionContextsCleared_ = this.onExecutionContextsCleared_.bind(this);
    this.onFrameNavigated_ = this.onFrameNavigated_.bind(this);
  }

  getParam_(params, path) {
    let value = get(params, path);

    if (value === undefined) {
      throw new error.WebDriverError(`Missing or invalid parameter: ${path}.`);
    } else {
      return value;
    }
  }

  onExecutionContextCreated_(params) {
    let context = this.getParam_(params, 'context');

    if (context.id === undefined) {
      throw new error.WebDriverError('Invalid context.');
    }

    let isDefault, frameId;

    if (context.auxData) {
      isDefault = context.auxData.isDefault;
      frameId = context.auxData.frameId;
    }

    // TODO: remove this when we stop supporting Chrome 53.
    if (context.isDefault !== undefined) {
      isDefault = context.isDefault;
    }

    // TODO: remove this when we stop supporting Chrome 53.
    if (context.frameId !== undefined) {
      frameId = context.frameId;
    }

    if (isDefault && frameId !== undefined) {
      this.log_.finest(`tab ${this.debugger_.getTabId()} add frame tracking: ${frameId} -> ${context.id}`);
      this.frameToContextMap_.set(frameId, context.id);
    }
  }

  onExecutionContextDestroyed_(params) {
    let executionContextId = this.getParam_(params, 'executionContextId');

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
    let frame = this.getParam_(params, 'frame');

    if (frame.parentId === undefined) {
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

    if (contextId !== undefined) {
      return contextId;
    } else {
      throw new error.WebDriverError('Frame does not have execution context.');
    }
  }
}


module.exports = FrameTracker;
