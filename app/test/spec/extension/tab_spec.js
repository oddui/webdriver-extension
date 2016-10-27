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
    });

    describe('connectIfNecessary', () => {
      beforeEach(() => {
        sinon.spy(dbg, 'connect');
        sinon.spy(tab.frameTracker_, 'connect');
        sinon.spy(tab.dialogManager_, 'connect');

        return tab.connectIfNecessary();
      });

      it('connects debugger, frame tracker and dialog manager', () => {
        expect(dbg.connect.calledWith(tab.getId())).to.be.true;
        expect(tab.frameTracker_.connect.calledWith(dbg)).to.be.true;
        expect(tab.dialogManager_.connect.calledWith(dbg)).to.be.true;
      });

      it('resovles if already connected', () => {
        expect(dbg.connect.calledOnce).to.be.true;
        expect(tab.frameTracker_.connect.calledOnce).to.be.true;
        expect(tab.dialogManager_.connect.calledOnce).to.be.true;
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

    describe('load', () => {
      beforeEach(() => {
        return tab.connectIfNecessary()
          .then(() => dbg.sendCommand.reset());
      });

      it('sends Page.navigate debugging command', () => {
        const url = 'site.local';
        tab.load(url);
        expect(dbg.sendCommand.calledWith('Page.navigate', { url: url })).to.be.true;
      });
    });

    describe('reload', () => {
      beforeEach(() => {
        return tab.connectIfNecessary()
          .then(() => dbg.sendCommand.reset());
      });

      it('sends Page.reload debugging command', () => {
        tab.reload();
        expect(dbg.sendCommand.calledWith('Page.reload')).to.be.true;
      });
    });

  });

});