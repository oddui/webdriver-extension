'use strict';

const expect = require('chai').expect,
  sinon = require('sinon'),
  error = require('selenium-webdriver/lib/error'),
  FakeDebugger = require('./fake_debugger'),
  JavaScriptDialogManager = require('../../../src/lib/extension/javascript_dialog_manager');


describe('extension', () => {

  describe('JavaScriptDialogManager', () => {
    let dialogManager, dbg;

    beforeEach(() => {
      dialogManager = new JavaScriptDialogManager();

      dbg = new FakeDebugger();
      sinon.spy(dbg, 'on');
      sinon.spy(dbg, 'sendCommand');

      return dbg.connect(1)
        .then(() => dialogManager.connect(dbg))
        .then(() => dialogManager.unhandledDialogQueue_ = ['alert1', 'alert2']);
    });

    afterEach(() => {
      dbg.on.restore();
      dbg.sendCommand.restore();
    });

    describe('connect', () => {
      it('adds listeners to debugger events', () => {
        expect(dbg.on.calledWith('Page.javascriptDialogOpening', dialogManager.onJavaScriptDialogOpening_)).to.be.true;
        expect(dbg.on.calledWith('Page.javascriptDialogClosed', dialogManager.onJavaScriptDialogClosed_)).to.be.true;
      });

      it('enables reporting page events', () => {
        expect(dbg.sendCommand.calledWith('Page.enable'));
      });
    });

    describe('onJavaScriptDialogOpening', () => {
      it('throws WebDriverError if parameters has invalid message', () => {
        expect(() => dbg.emit('Page.javascriptDialogOpening', { message: null }))
          .to.throw(error.WebDriverError, /invalid message/i);
      });

      it('pushes message to the end of the unhandled dialog queue', () => {
        dbg.emit('Page.javascriptDialogOpening', { message: 'alert' });
        expect(dialogManager.unhandledDialogQueue_[dialogManager.unhandledDialogQueue_.length - 1]).to.equal('alert');
      });
    });

    describe('onJavaScriptDialogClosed', () => {
      it('clears the unhandled dialog queue', () => {
        dbg.emit('Page.javascriptDialogClosed');
        expect(dialogManager.isDialogOpen()).to.be.false;
      });
    });

    describe('isDialogOpen', () => {
      it('returns true if unhandled dialog queue is not empty', () => {
        expect(dialogManager.isDialogOpen()).to.be.true;
      });
    });

    describe('getDialogMessage', () => {
      it('throws no such alert error if unhandled dialog queue is empty', () => {
        dialogManager.unhandledDialogQueue_.length = 0;
        expect(() => dialogManager.getDialogMessage()).to.throw(error.NoSuchAlertError);
      });

      it('returns the message at the front of the unhandled dialog queue', () => {
        expect(dialogManager.getDialogMessage()).to.equal('alert1');
      });
    });

    describe('handleDialog', () => {
      it('rejects with no such alert error if unhandled dialog queue is empty', () => {
        dialogManager.unhandledDialogQueue_.length = 0;

        return dialogManager.handleDialog()
          .catch(e => {
            expect(e).to.be.instanceOf(error.NoSuchAlertError);
          });
      });

      it('sends Page.handleJavaScriptDialog debugging command', () => {
        return dialogManager.handleDialog()
          .then(() => {
            expect(dbg.sendCommand.calledWith('Page.handleJavaScriptDialog'));
          });
      });
    });

  });

});
