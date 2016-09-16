'use strict';

const expect = require('chai').expect,
  sinon = require('sinon'),
  fakeChromeApi = require('./fake_chrome_api'),
  Debugger = require('../../../src/lib/extension/debugger');


describe('extension', function() {

  describe('Debugger', function() {

    let dbg, tab = { id: 1 };

    before(fakeChromeApi.use);
    after(fakeChromeApi.restore);

    beforeEach(function() {
      dbg = new Debugger();
    });


    describe('connect', function() {
      beforeEach(function() {
        return dbg.connect(tab);
      });

      afterEach(function() {
        return dbg.disconnect();
      });

      it('returns resolved promise if connect again', function() {
        return dbg.connect(tab)
          .then(function() {
            expect(dbg.tabId_).to.equal(tab.id);
          });
      });

      it('emits debugger events', function() {
        let listener = sinon.spy(),
          params = { arg: 1 };
        dbg.on('method', listener);

        chrome.debugger.emitEvent('method', params);
        expect(listener.calledWith(params)).to.be.true;
      });

      it('cleans debugger state on unexpected detach', function() {
        chrome.debugger.emitDetach('user_canceled');
        expect(dbg.tabId_).to.be.null;
      });
    });


    describe('disconnect', function() {
      beforeEach(function() {
        return dbg.connect(tab)
          .then(dbg.disconnect.bind(dbg));
      });

      it('returns resolved promise if disconnect again', function() {
        return dbg.disconnect()
          .then(function() {
            expect(dbg.tabId_).to.be.null;
          });
      });

      it('cleans debugger state', function() {
        expect(dbg.tabId_).to.be.null;
      });
    });


    describe('sendCommand', function() {

      it('throws error if not connected to debuggee', function() {
        expect(function() {
          dbg.sendCommand();
        }).to.throw(/connect\(\) must be called/i);
      });

      it('resolves with command result', function() {
        return dbg.connect(tab)
          .then(function() {
            return dbg.sendCommand();
          })
          .then(function(result) {
            expect(result).not.to.be.undefined;
          });
      });
    });

  });

});
