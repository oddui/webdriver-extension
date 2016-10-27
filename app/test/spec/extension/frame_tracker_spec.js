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

      dbg = new FakeDebugger();
      sinon.spy(dbg, 'on');
      sinon.spy(dbg, 'sendCommand');

      return dbg.connect(1)
        .then(() => frameTracker.connect(dbg))
        .then(() => {
          frameTracker.frameToContextMap_.set(randomFrameId(), randomContextId());
        });
    });

    afterEach(() => {
      dbg.on.restore();
      dbg.sendCommand.restore();
    });

    describe('connect', () => {
      it('adds listeners to debugger events', () => {
        expect(dbg.on.calledWith('Runtime.executionContextCreated', frameTracker.onExecutionContextCreated_)).to.be.true;
        expect(dbg.on.calledWith('Runtime.executionContextDestroyed', frameTracker.onExecutionContextDestroyed_)).to.be.true;
        expect(dbg.on.calledWith('Runtime.executionContextsCleared', frameTracker.onExecutionContextsCleared_)).to.be.true;
        expect(dbg.on.calledWith('Page.frameNavigated', frameTracker.onFrameNavigated_)).to.be.true;
      });

      it('enables reporting runtime and page events', () => {
        expect(dbg.sendCommand.calledWith('Runtime.enable')).to.be.true;
        expect(dbg.sendCommand.calledWith('Page.enable')).to.be.true;
      });
    });

    describe('onExecutionContextCreated', () => {
      it('throws WebDriverError if parameters missing context', () => {
        expect(() => dbg.emit('Runtime.executionContextCreated', {}))
          .to.throw(error.WebDriverError, /missing .+ context/i);
      });

      it('throws WebDriverError if parameters has invalid context', () => {
        expect(() => dbg.emit('Runtime.executionContextCreated', { context: {} }))
          .to.throw(error.WebDriverError, /invalid context/i);
      });

      it('tracks frame if context is default and contians frameId', () => {
        const context = {
          id: randomContextId(),
          auxData: {
            isDefault: true,
            frameId: randomFrameId()
          }
        };
        dbg.emit('Runtime.executionContextCreated', { context: context });

        expect(frameTracker.getContextIdForFrame(context.auxData.frameId)).to.equal(context.id);
      });
    });

    describe('onExecutionContextDestroyed', () => {
      let frameId, contextId;

      beforeEach(() => {
        frameId = randomFrameId();
        contextId = randomContextId();
        frameTracker.frameToContextMap_.set(frameId, contextId);
      });

      it('throws WebDriverError if parameters missing executionContextId', () => {
        expect(() => dbg.emit('Runtime.executionContextDestroyed', {}))
          .to.throw(error.WebDriverError, /missing .+ executionContextId/i);
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
        dbg.emit('Page.frameNavigated', { frame: {} });

        expect(frameTracker.frameToContextMap_.size).to.equal(0);
      });
    });

    describe('getContextIdForFrame', () => {
      it('clears the internal frame tracking map if top frame navigated', () => {
        dbg.emit('Runtime.executionContextsCleared');

        expect(frameTracker.frameToContextMap_.size).to.equal(0);
      });
    });
  });

});


function randomNumber(min, max) {
  return Math.floor(Math.random() * (max - min)) + min;
}

function randomFrameId() {
  return randomNumber(0, 100).toString();
}

function randomContextId() {
  return randomNumber(0, 100);
}
