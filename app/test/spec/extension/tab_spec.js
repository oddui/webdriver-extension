'use strict';

const expect = require('chai').expect,
  sinon = require('sinon'),
  FakeDebugger = require('./fake_debugger'),
  Tab = require('../../../src/lib/extension/tab');


describe('extension', () => {

  describe('Tab', () => {
    let tab, dbg;

    beforeEach(() => {
      dbg = new FakeDebugger();
      sinon.spy(dbg, 'sendCommand');

      tab = new Tab({ id: 1 });
      tab.debugger_ = dbg;

      return tab.connectIfNecessary();
    });

    afterEach(() => {
      dbg.sendCommand.restore();
    });

    describe('getContextIdForFrame', () => {
      it('calls getContextIdForFrame on frameTracker', () => {
        sinon.spy(tab.frameTracker_, 'getContextIdForFrame');
        try {
          tab.getContextIdForFrame();
        } catch(e) { /** recover */ }

        expect(tab.frameTracker_.getContextIdForFrame.calledOnce).to.be.true;
      });
    });

    describe('setMobileEmulationOverride', () => {
      it('sends debugging commands', () => {
        expect(dbg.sendCommand.calledWith('Emulation.setDeviceMetricsOverride'));
        expect(dbg.sendCommand.calledWith('Network.enable'));
        expect(dbg.sendCommand.calledWith('Network.setUserAgentOverride'));
        expect(dbg.sendCommand.calledWith('Emulation.setTouchEmulationEnabled'));
      });
    });

    describe('load', () => {
      it('sends Page.navigate debugging command', () => {
        const url = 'site.local';
        tab.load(url);
        expect(dbg.sendCommand.calledWith('Page.navigate', { url: url })).to.be.true;
      });
    });

    describe('reload', () => {
      it('sends Page.reload debugging command', () => {
        tab.reload();
        expect(dbg.sendCommand.calledWith('Page.reload')).to.be.true;
      });
    });

  });

});
