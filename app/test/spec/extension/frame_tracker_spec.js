'use strict';

const expect = require('chai').expect,
  sinon = require('sinon'),
  error = require('selenium-webdriver/lib/error'),
  FakeDebugger = require('./fake_debugger'),
  FrameTracker = require('../../../src/lib/extension/frame_tracker');


describe('extension', () => {

  describe('FrameTracker', () => {
    let frameTracker, dbg;

    beforeEach(() => {
      frameTracker = new FrameTracker();
      frameTracker.frameToContextMap_.set(randomNumber(0, 100), randomNumber(0, 100));

      dbg = new FakeDebugger();
      sinon.spy(dbg, 'on');
      sinon.spy(dbg, 'sendCommand');

      return dbg.connect(1)
        .then(() => frameTracker.connect(dbg));
    });

    afterEach(() => {
      dbg.on.restore();
      dbg.sendCommand.restore();
    });

    describe('connect', () => {
      it('adds listeners to debugger events', () => {
        expect(dbg.on.calledWith('Runtime.executionContextCreated', dbg.onExecutionContextCreated_));
        expect(dbg.on.calledWith('Runtime.executionContextDestroyed', dbg.onExecutionContextDestroyed_));
        expect(dbg.on.calledWith('Runtime.executionContextsCleared', dbg.onExecutionContextsCleared_));
        expect(dbg.on.calledWith('Page.frameNavigated', dbg.onFrameNavigated_));
      });

      it('enables reporting runtime and page events', () => {
        expect(dbg.sendCommand.calledWith('Runtime.enable'));
        expect(dbg.sendCommand.calledWith('Page.enable'));
      });
    });

    describe('onExecutionContextCreated', () => {
      it('throws WebDriverError if parameters missing context', () => {
        expect(() => dbg.emit('Runtime.executionContextCreated', {}))
          .to.throw(error.WebDriverError, /missing context/i);
      });

      it('throws WebDriverError if parameters has invalid context', () => {
        expect(() => dbg.emit('Runtime.executionContextCreated', { context: {} }))
          .to.throw(error.WebDriverError, /invalid context/i);
      });

      it('tracks frame if context is default and contians frameId', () => {
        const context = {
          id: randomNumber(0, 100),
          auxData: {
            isDefault: true,
            frameId: randomNumber(0, 100)
          }
        };
        dbg.emit('Runtime.executionContextCreated', { context: context });

        expect(frameTracker.getContextIdForFrame(context.auxData.frameId)).to.equal(context.id);
      });
    });

    describe('onExecutionContextDestroyed', () => {
      let frameId, contextId;

      beforeEach(() => {
        frameId = randomNumber(0, 100);
        contextId = randomNumber(0, 100);
        frameTracker.frameToContextMap_.set(frameId, contextId);
      });

      it('throws WebDriverError if parameters missing executionContextId', () => {
        expect(() => dbg.emit('Runtime.executionContextDestroyed', {}))
          .to.throw(error.WebDriverError, /missing executionContextId/i);
      });

      it('deletes the tracking frame', () => {
        dbg.emit('Runtime.executionContextDestroyed', { executionContextId: contextId });

        expect(() => frameTracker.getContextIdForFrame(frameId))
          .to.throw(error.WebDriverError, /frame does not have execution context/i);
      });
    });

    describe('onExecutionContextsCleared', () => {
      it('clears the internal frame tracking map', () => {
        dbg.emit('Runtime.executionContextsCleared');

        expect(frameTracker.frameToContextMap_.size).to.equal(0);
      });
    });

    describe('Page.frameNavigated', () => {
      it('clears the internal frame tracking map if top frame navigated', () => {
        dbg.emit('Page.frameNavigated', { frame: { parentId: null } });

        expect(frameTracker.frameToContextMap_.size).to.equal(0);
      });
    });

    describe('getContextIdForFrame', () => {
      it('clears the internal frame tracking map if top frame navigated', () => {
        dbg.emit('Runtime.executionContextsCleared');

        expect(frameTracker.frameToContextMap_.size).to.equal(0);
      });
    });


    function randomNumber(min, max) {
      return Math.floor(Math.random() * (max - min)) + min;
    }
  });

});
