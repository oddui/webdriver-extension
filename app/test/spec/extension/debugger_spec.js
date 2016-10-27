'use strict';

const expect = require('chai').expect,
  sinon = require('sinon'),
  fakeChromeApi = require('./fake_chrome_api'),
  Debugger = require('../../../src/lib/extension/debugger');


describe('extension', () => {

  describe('Debugger', () => {

    let dbg, tab = { id: 1 };

    before(fakeChromeApi.use);
    after(fakeChromeApi.restore);

    beforeEach(() => dbg = new Debugger());


    describe('isConnected', () => {
      it('returns true if connected', () => {
        return dbg.connect(tab.id)
          .then(() => expect(dbg.isConnected()).to.be.true)
          .then(() => dbg.disconnect())
          .then(() => expect(dbg.isConnected()).to.be.false);
      });
    });


    describe('connect', () => {

      beforeEach(() => dbg.connect(tab.id));
      afterEach(() => dbg.disconnect());

      it('returns resolved promise if connect again', () => {
        return dbg.connect(tab.id)
          .then(() => expect(dbg.getTabId()).to.equal(tab.id));
      });

      it('emits debugger events', () => {
        let listener = sinon.spy(),
          params = { arg: 1 };
        dbg.on('method', listener);

        chrome.debugger.emitEvent('method', params);
        expect(listener.calledWith(params)).to.be.true;
      });

      it('cleans debugger state on unexpected detach', () => {
        chrome.debugger.emitDetach('user_canceled');
        expect(dbg.getTabId()).to.be.null;
      });
    });


    describe('disconnect', () => {
      beforeEach(() => {
        return dbg.connect(tab.id)
          .then(() => dbg.disconnect());
      });

      it('returns resolved promise if disconnect again', () => {
        return dbg.disconnect()
          .then(() => expect(dbg.getTabId()).to.be.null);
      });

      it('cleans debugger state', () => expect(dbg.getTabId()).to.be.null);
    });


    describe('sendCommand', () => {
      it('throws error if not connected to debuggee', () => {
        expect(() => dbg.sendCommand()).to.throw(/connect\(\) must be called/i);
      });

      it('resolves with command result', () => {
        return dbg.connect(tab.id)
          .then(() => dbg.sendCommand())
          .then((result) => expect(result).not.to.be.undefined);
      });

      it('emits commandSuccess event', () => {
        let listener = sinon.spy();

        return dbg.connect(tab.id)
          .then(() => dbg.onCommandSuccess(listener))
          .then(() => dbg.sendCommand('method', {}))
          .then((result) => expect(listener.calledWith('method', sinon.match(result))).be.true);
      });

      describe('with timeout', () => {
        beforeEach(() => chrome.debugger.setCommandDuration(200));

        it('resolves if not timed out', () => {
          return dbg.connect(tab.id)
            .then(() => dbg.sendCommand('method', {}, 300))
            .then((result) => expect(result).not.to.be.undefined);
        });

        it('rejects if timed out', () => {
          return dbg.connect(tab.id)
            .then(() => dbg.sendCommand('method', {}, 100))
            .catch((e) => expect(e.message).to.match(/timed out/i))
            .then(() => {
              // Give enough time for the result callback to execute before
              // the fakeChromeApi gets restored.
              return new Promise(resolve => setTimeout(resolve, 200));
            });
        });
      });
    });

  });

});
