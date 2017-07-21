'use strict';

const expect = require('chai').expect,
  sinon = require('sinon'),
  error = require('selenium-webdriver/lib/error'),
  FakeDebugger = require('./client/fake_debugger'),
  PageLoadStrategy = require('./navigation_tracker').PageLoadStrategy,
  Tab = require('./tab');


describe('debugger', () => {

  describe('Tab', () => {
    let tab, dbg;

    beforeEach(() => {
      dbg = new FakeDebugger();
      sinon.spy(dbg, 'sendCommand');

      tab = new Tab({ id: 1 }, PageLoadStrategy.NORMAL);
      tab.debugger_ = dbg;
    });

    describe('connectIfNecessary', () => {
      beforeEach(() => {
        sinon.spy(dbg, 'connect');
        sinon.spy(tab.frameTracker_, 'connect');
        sinon.spy(tab.dialogManager_, 'connect');
        sinon.spy(tab.navigationTracker_, 'connect');

        return tab.connectIfNecessary();
      });

      it('connects debugger, frame tracker, dialog manager and navigation tracker', () => {
        expect(dbg.connect.calledWith(tab.getId())).to.be.true;
        expect(tab.frameTracker_.connect.calledWith(dbg)).to.be.true;
        expect(tab.dialogManager_.connect.calledWith(dbg)).to.be.true;
        expect(tab.navigationTracker_.connect.calledWith(dbg)).to.be.true;
      });

      it('resovles if already connected', () => {
        return tab.connectIfNecessary()
          .then(() => {
            expect(dbg.connect.calledOnce).to.be.true;
            expect(tab.frameTracker_.connect.calledOnce).to.be.true;
            expect(tab.dialogManager_.connect.calledOnce).to.be.true;
            expect(tab.navigationTracker_.connect.calledOnce).to.be.true;
          });
      });
    });

    describe('getContextIdForFrame', () => {
      beforeEach(() => tab.connectIfNecessary());

      it('calls getContextIdForFrame on frameTracker', () => {
        sinon.spy(tab.frameTracker_, 'getContextIdForFrame');
        try {
          tab.getContextIdForFrame();
        } catch(e) { /** recover */ }

        expect(tab.frameTracker_.getContextIdForFrame.calledOnce).to.be.true;
      });
    });

    describe('setMobileEmulationOverride', () => {
      beforeEach(() => {
        return tab.connectIfNecessary()
          .then(() => dbg.sendCommand.reset())
          .then(() => tab.setMobileEmulationOverride());
      });

      it('sends debugging commands', () => {
        expect(dbg.sendCommand.calledWith('Emulation.setDeviceMetricsOverride', sinon.match.object)).to.be.true;
        expect(dbg.sendCommand.calledWith('Network.enable')).to.be.true;
        expect(dbg.sendCommand.calledWith('Network.setUserAgentOverride')).to.be.true;
        expect(dbg.sendCommand.calledWith('Emulation.setTouchEmulationEnabled')).to.be.true;
      });
    });

    describe('pending navigation', () => {
      beforeEach(() => {
        sinon.stub(tab.navigationTracker_, 'isPendingNavigation')
          .returns(Promise.resolve(false));

        return tab.connectIfNecessary();
      });

      describe('isPendingNavigation', () => {
        it('whether the tabs is pending navigation', () => {
          return tab.isPendingNavigation()
            .then(pending => {
              expect(pending).to.be.false;
              expect(tab.navigationTracker_.isPendingNavigation.calledOnce).to.be.true;
            });
        });
      });

      describe('isNotPendingNavigation', () => {
        it('whether the tabs is not pending navigation', () => {
          return tab.isNotPendingNavigation()
            .then(notPending => {
              expect(notPending).to.be.true;
              expect(tab.navigationTracker_.isPendingNavigation.calledOnce).to.be.true;
            });
        });
      });

      describe('waitForPendingNavigation', () => {
        const n = 3;

        beforeEach(() => {
          for(let i = 0; i < n; i++) {
            tab.navigationTracker_.isPendingNavigation.onCall(i).returns(Promise.resolve(true));
          }
        });

        it('polls pending status until is not pending', () => {
          return tab.waitForPendingNavigation()
            .then(() => expect(tab.navigationTracker_.isPendingNavigation.callCount).to.equal(n + 1));
        });

        it('times out', () => {
          return tab.waitForPendingNavigation(null, 1)
            .catch(e => expect(e).to.be.instanceOf(error.TimeoutError));
        });
      });
    });

    describe('load', () => {
      beforeEach(() => {
        return tab.connectIfNecessary()
          .then(() => dbg.sendCommand.reset());
      });

      it('sends Page.navigate debugging command', () => {
        const url = 'site.local',
          timeout = 10000;
        return tab.load(url, timeout)
          .then(() => expect(dbg.sendCommand.calledWith('Page.navigate', { url: url }, timeout)).to.be.true);
      });
    });

    describe('reload', () => {
      beforeEach(() => {
        return tab.connectIfNecessary()
          .then(() => dbg.sendCommand.reset());
      });

      it('sends Page.reload debugging command', () => {
        const timeout = 10000;
        return tab.reload(timeout)
          .then(() => expect(dbg.sendCommand.calledWith('Page.reload', { ignoreCache: false }, timeout)).to.be.true);
      });
    });

  });

});
