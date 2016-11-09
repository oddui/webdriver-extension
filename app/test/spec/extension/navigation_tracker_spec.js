'use strict';

const expect = require('chai').expect,
  sinon = require('sinon'),
  error = require('selenium-webdriver/lib/error'),
  FakeDebugger = require('./fake_debugger'),
  JavaScriptDialogManager = require('../../../src/lib/extension/javascript_dialog_manager'),
  navigationTrackers = require('../../../src/lib/extension/navigation_tracker'),
  LoadingState = navigationTrackers.LoadingState,
  NonBlockingNavigationTracker = navigationTrackers.NonBlockingNavigationTracker,
  NavigationTracker = navigationTrackers.NavigationTracker;


describe('extension', () => {

  describe('create', () => {
    const PageLoadStrategy = navigationTrackers.PageLoadStrategy,
      create = navigationTrackers.create;

    it('returns an instance of NonBlockingNavigationTracker if strategy is none', () => {
      expect(create(PageLoadStrategy.NONE)).to.be.instanceOf(NonBlockingNavigationTracker);
    });

    it('returns an instance of NavigationTracker if strategy is normal', () => {
      expect(create(PageLoadStrategy.NORMAL)).to.be.instanceOf(NavigationTracker);
    });

    it('throws if strategy is invalid', () => {
      expect(() => create('invalid')).to.throw(error.WebDriverError, /not supported/i);
    });
  });

  describe('NonBlockingNavigationTracker', () => {
    let tracker;

    beforeEach(() => {
      tracker = new NonBlockingNavigationTracker();
    });

    describe('isPendingNavigation', () => {
      it('is always false', () => {
        expect(tracker.isPendingNavigation()).to.be.false;
      });
    });
  });

  describe('NavigationTracker', () => {
    let tracker,
      dialogManager,
      dbg;

    beforeEach(() => {
      dialogManager = new JavaScriptDialogManager();
      sinon.stub(dialogManager, 'isDialogOpen').returns(false);

      dbg = new FakeDebugger();
      sinon.spy(dbg, 'on');
      sinon.spy(dbg, 'onCommandSuccess');
      sinon.spy(dbg, 'sendCommand');

      tracker = new NavigationTracker(dialogManager);

      return dbg.connect(1)
        .then(() => tracker.connect(dbg));
    });

    afterEach(() => {
      dbg.on.restore();
      dbg.onCommandSuccess.restore();
      dbg.sendCommand.restore();
    });

    describe('connect', () => {
      it('adds listeners to debugger events', () => {
        expect(dbg.on.calledWith('Inspector.targetCrashed', tracker.onTargetCrashed_)).to.be.true;
        expect(dbg.on.calledWith('Page.frameClearedScheduledNavigation', tracker.onFrameClearedScheduledNavigation_)).to.be.true;
        expect(dbg.on.calledWith('Page.frameNavigated', tracker.onFrameNavigated_)).to.be.true;
        expect(dbg.on.calledWith('Page.frameScheduledNavigation', tracker.onFrameScheduledNavigation_)).to.be.true;
        expect(dbg.on.calledWith('Page.frameStartedLoading', tracker.onFrameStartedLoading_)).to.be.true;
        expect(dbg.on.calledWith('Page.frameStoppedLoading', tracker.onFrameStoppedLoading_)).to.be.true;
        expect(dbg.on.calledWith('Page.loadEventFired', tracker.onLoadEventFired_)).to.be.true;
        expect(dbg.on.calledWith('Runtime.executionContextCreated', tracker.onExecutionContextCreated_)).to.be.true;
        expect(dbg.on.calledWith('Runtime.executionContextDestroyed', tracker.onExecutionContextDestroyed_)).to.be.true;
        expect(dbg.on.calledWith('Runtime.executionContextsCleared', tracker.onExecutionContextsCleared_)).to.be.true;
        expect(dbg.onCommandSuccess.calledWith(tracker.onCommandSuccess_)).to.be.true;
      });

      it('enables reporting page events', () => {
        expect(dbg.sendCommand.calledWith('Page.enable')).to.be.true;
      });
    });

    describe('isPendingNavigation', () => {
      beforeEach(() => {
        dbg.setCommandResult('Runtime.evaluate', { result: { value: 1 } });
        dbg.setCommandResult('DOM.getDocument', { root: { baseURL: 'http://test.local' } } );
      });

      it('resolves false if there is JavaScript dialog open', () => {
        dialogManager.isDialogOpen.returns(true);

        return tracker.isPendingNavigation()
          .then(pending => expect(pending).to.be.false);
      });

      it('resolves false if debugger is not connected', () => {
        dbg.disconnect();

        return tracker.isPendingNavigation()
          .then(pending => expect(pending).to.be.false);
      });

      it('frame load start -> stop', () => {
        let frameId = 'f';

        dbg.emit('Page.frameStartedLoading', { frameId: frameId });

        return tracker.isPendingNavigation(frameId)
          .then(pending => expect(pending).to.be.true)
          .then(() => {
            dbg.emit('Page.frameStoppedLoading', { frameId: frameId });

            return tracker.isPendingNavigation(frameId);
          })
          .then(pending => expect(pending).to.be.false);
      });

      // When a frame fails to load due to (for example) a DNS resolution error, we
      // can sometimes see two Page.frameStartedLoading events with only a single
      // Page.frameStoppedLoading event.
      it('frame load start -> start -> stop', () => {
        let frameId = 'f';

        dbg.emit('Page.frameStartedLoading', { frameId: frameId });

        return tracker.isPendingNavigation(frameId)
          .then(pending => expect(pending).to.be.true)
          .then(() => {
            dbg.emit('Page.frameStartedLoading', { frameId: frameId });

            return tracker.isPendingNavigation(frameId);
          })
          .then(pending => expect(pending).to.be.true)
          .then(() => {
            dbg.emit('Page.frameStoppedLoading', { frameId: frameId });

            return tracker.isPendingNavigation(frameId);
          })
          .then(pending => expect(pending).to.be.false);
      });

      it('multiple frame load', () => {
        // pendingFrameSet_.size === 0

        dbg.emit('Page.frameStartedLoading', { frameId: '1' });
        // pendingFrameSet_.size === 1

        return tracker.isPendingNavigation('1')
          .then(pending => expect(pending).to.be.true)
          .then(() => {
            dbg.emit('Page.frameStartedLoading', { frameId: '2' });
            // pendingFrameSet_.size === 2

            return tracker.isPendingNavigation('2');
          })
          .then(pending => expect(pending).to.be.true)
          .then(() => {
            dbg.emit('Page.frameStoppedLoading', { frameId: '2' });
            // pendingFrameSet_.size === 1

            return tracker.isPendingNavigation('2');
          })
          .then(pending => expect(pending).to.be.true)
          .then(() => {
            dbg.emit('Page.frameStoppedLoading', { frameId: '1' });
            // pendingFrameSet_.size === 0

            return tracker.isPendingNavigation('1');
          })
          .then(pending => expect(pending).to.be.false)
          .then(() => {
            dbg.emit('Page.frameStoppedLoading', { frameId: '3' });
            // pendingFrameSet_.size === 0

            return tracker.isPendingNavigation('3');
          })
          .then(pending => expect(pending).to.be.false)
          .then(() => {
            dbg.emit('Page.frameStartedLoading', { frameId: '3' });
            // pendingFrameSet_.size === 1

            return tracker.isPendingNavigation('3');
          })
          .then(pending => expect(pending).to.be.true);
      });

      it('navigation scheduled then loaded', () => {
        let frameId = 'f';

        tracker = new NavigationTracker(dialogManager, LoadingState.NotLoading);

        return tracker.connect(dbg)
          .then(() => {
            dbg.emit('Page.frameScheduledNavigation', { delay: 0, frameId: frameId });

            return tracker.isPendingNavigation(frameId);
          })
          .then(pending => expect(pending).to.be.true)
          .then(() => {
            dbg.emit('Page.frameStartedLoading', { frameId: frameId });

            return tracker.isPendingNavigation(frameId);
          })
          .then(pending => expect(pending).to.be.true)
          .then(() => {
            dbg.emit('Page.frameClearedScheduledNavigation', { frameId: frameId });

            return tracker.isPendingNavigation(frameId);
          })
          .then(pending => expect(pending).to.be.true)
          .then(() => {
            dbg.emit('Page.frameStoppedLoading', { frameId: frameId });

            return tracker.isPendingNavigation(frameId);
          })
          .then(pending => expect(pending).to.be.false);
      });

      it('navigation scheduled for other frame', () => {
        tracker = new NavigationTracker(dialogManager, LoadingState.NotLoading);

        return tracker.connect(dbg)
          .then(() => {
            dbg.emit('Page.frameScheduledNavigation', { delay: 0, frameId: 'other' });

            return tracker.isPendingNavigation('f');
          })
          .then(pending => expect(pending).to.be.false);
      });

      it('navigation scheduled then cancelled', () => {
        let frameId = 'f';

        tracker = new NavigationTracker(dialogManager, LoadingState.NotLoading);

        return tracker.connect(dbg)
          .then(() => {
            dbg.emit('Page.frameScheduledNavigation', { delay: 0, frameId: frameId });

            return tracker.isPendingNavigation(frameId);
          })
          .then(pending => expect(pending).to.be.true)
          .then(() => {
            dbg.emit('Page.frameClearedScheduledNavigation', { frameId: frameId });

            return tracker.isPendingNavigation(frameId);
          })
          .then(pending => expect(pending).to.be.false);
      });

      it('navigation scheduled too far away', () => {
        tracker = new NavigationTracker(dialogManager, LoadingState.NotLoading);

        return tracker.connect(dbg)
          .then(() => {
            dbg.emit('Page.frameScheduledNavigation', { delay: 10, frameId: 'f' });

            return tracker.isPendingNavigation('f');
          })
          .then(pending => expect(pending).to.be.false);
      });

      it('discard scheduled navigations on main frame commit', () => {
        tracker = new NavigationTracker(dialogManager, LoadingState.NotLoading);

        return tracker.connect(dbg)
          .then(() => {
            dbg.emit('Page.frameScheduledNavigation', { delay: 0, frameId: 'subframe' });

            return tracker.isPendingNavigation('subframe');
          })
          .then(pending => expect(pending).to.be.true)
          .then(() => {
            dbg.emit('Page.frameNavigated', {
              frame: { parentId: 'something', name: '', url: 'http://test.local' }
            });

            return tracker.isPendingNavigation('subframe');
          })
          .then(pending => expect(pending).to.be.true)
          .then(() => {
            dbg.emit('Page.frameNavigated', {
              frame: { id: 'f', url: 'http://test.local' }
            });

            return tracker.isPendingNavigation('subframe');
          })
          .then(pending => expect(pending).to.be.false);
      });

      it('unknown state fails to determine state', () => {
        dbg.setCommandResult('Runtime.evaluate', {});

        return tracker.isPendingNavigation()
          .catch(e => {
            expect(e).to.be.instanceOf(error.WebDriverError);
            expect(e.message).to.match(/cannot determine loading status/i);
          });
      });

      it('unknown state page not load at all', () => {
        dbg.setCommandResult('DOM.getDocument', { root: { baseURL: '' } } );

        return tracker.isPendingNavigation('f')
          .then(pending => expect(pending).to.be.true);
      });

      it('unknown state forces start', () => {
        return tracker.isPendingNavigation('f')
          .then(pending => expect(pending).to.be.true);
      });

      it('unknown state forces start receives stop');

      it('on successful navigate', () => {
        let frameId = 'f';

        tracker = new NavigationTracker(dialogManager, LoadingState.NotLoading);

        return tracker.connect(dbg)
          .then(() => dbg.sendCommand('Page.navigate'))
          .then(() => tracker.isPendingNavigation(frameId))
          .then(pending => expect(pending).to.be.true)
          .then(() => {
            dbg.emit('Page.loadEventFired');

            return tracker.isPendingNavigation(frameId);
          })
          .then(pending => expect(pending).to.be.true)
          .then(() => {
            dbg.emit('Page.frameStoppedLoading', { frameId: frameId });

            return tracker.isPendingNavigation(frameId);
          })
          .then(pending => expect(pending).to.be.false);
      });

      it('on target crashed', () => {
        return tracker.isPendingNavigation()
          .then(pending => expect(pending).to.be.true)
          .then(() => {
            dbg.emit('Inspector.targetCrashed');

            return tracker.isPendingNavigation();
          })
          .then(pending => expect(pending).to.be.false);
      });
    });

    describe('setTimedOut', () => {
      it('sets timed out state', () => {
        tracker.setTimedOut(true);
        expect(tracker.timedOut_).to.be.true;
      });
    });

    describe('getParam_', () => {
      const object = { a: [{ 'b': { 'c': 3 } }] };

      it('returns the value at path', () => {
        expect(tracker.getParam_(object, 'a[0].b.c')).to.equal(3);
      });

      it('throws error.WebDriverError if the path is invalid', () => {
        expect(() => tracker.getParam_(object, 'invalid.path')).to.throw(error.WebDriverError);
      });
    });

  });

});
