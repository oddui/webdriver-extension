'use strict';

const expect = require('chai').expect,
  sinon = require('sinon'),
  error = require('selenium-webdriver/lib/error'),
  Debugger = require('./cri');


describe('debugger', () => {

  before(() => Debugger.CRI = require('./fake_cri'));


  describe('CriDebugger.list', () => {
    it('lists tabs', () => {
      return Debugger.list()
        .then(tabs => {
          expect(tabs).to.be.instanceof(Array);
        });
    });
  });

  describe('CriDebugger.new', () => {
    it('creates an empty tab', () => {
      return Debugger.new()
        .then(tab => {
          expect(typeof tab.id).to.equal('string');
        });
    });
  });

  describe('CriDebugger.close', () => {
    it('closes tabs', () => {
      return Debugger.list()
        .then(tabs => {
          return Debugger.close(tabs.map(tab => tab.id));
        });
    });
  });


  describe('CriDebugger', () => {

    let dbg, tab = { id: 1 };

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

      it('returns resolved promise if already connected', () => {
        return dbg.connect(tab.id)
          .then(() => expect(dbg.getTabId()).to.equal(tab.id));
      });

      it('emits debugger events', () => {
        let listener = sinon.spy(),
          params = { arg: 1 };
        dbg.on('method', listener);

        dbg.client_.emit('method', params);
        expect(listener.calledWith(params)).to.be.true;
      });

      it('cleans debugger state on unexpected detach', () => {
        dbg.client_.emit('disconnect');
        expect(dbg.getTabId()).to.be.null;
      });
    });


    describe('disconnect', () => {
      beforeEach(() => {
        return dbg.connect(tab.id)
          .then(() => dbg.disconnect());
      });

      it('returns resolved promise if not connected', () => {
        return dbg.disconnect()
          .then(() => expect(dbg.getTabId()).to.be.null);
      });

      it('cleans debugger state', () => expect(dbg.getTabId()).to.be.null);
    });


    describe('sendCommand', () => {

      afterEach(() => dbg.disconnect());

      it('rejects if not connected to debuggee', () => {
        return dbg.sendCommand()
          .catch(e => expect(e.message).to.match(/not\sconnected/i));
      });

      it('rejects if an evaluate-like method was thrown error');

      it('resolves with command result', () => {
        return dbg.connect(tab.id)
          .then(() => dbg.sendCommand())
          .then((result) => {
            expect(result).not.to.be.undefined;
            expect(dbg.commandInfoMap_.size).to.equal(0);
          });
      });

      it('emits commandSuccess event', () => {
        let listener = sinon.spy();

        return dbg.connect(tab.id)
          .then(() => dbg.onCommandSuccess(listener))
          .then(() => dbg.sendCommand('method', {}))
          .then(result => expect(listener.calledWith('method', sinon.match(result))).be.true);
      });

      it('rejects if blocked by JavaScript dialog', () => {
        return dbg.connect(tab.id)
          .then(() => {
            let promise;

            dbg.client_.setCommandDuration(100);
            promise = dbg.sendCommand('method');
            dbg.client_.emit('event', { method: 'Page.javascriptDialogOpening', params: { message: 'dialog message' } });
            return promise;
          })
          .then(() => Promise.reject('Expected method to reject.'))
          .catch(e => {
            expect(e).to.be.instanceOf(error.UnexpectedAlertOpenError);
            expect(e.getAlertText()).to.equal('dialog message');
          });
      });

      describe('with timeout', () => {
        beforeEach(() => {
          return dbg.connect(tab.id)
            .then(() => dbg.client_.setCommandDuration(200));
        });

        it('resolves if not timed out', () => {
          return dbg.sendCommand('method', {}, 300)
            .then((result) => expect(result).not.to.be.undefined);
        });

        it('rejects with error.TimeoutError if timed out', () => {
          return dbg.sendCommand('method', {}, 100)
            .then(() => Promise.reject('Expected method to reject.'))
            .catch(e => {
              expect(e).to.be.instanceOf(error.TimeoutError);
              expect(dbg.commandInfoMap_.size).to.equal(0);
            });
        });
      });
    });

  });

});
