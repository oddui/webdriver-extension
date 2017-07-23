'use strict';

const expect = require('chai').expect,
  error = require('selenium-webdriver/lib/error'),
  sessions = require('./session'),
  sinon = require('sinon'),
  { Session, FrameInfo, addSession, findSession, removeSession } = sessions;


describe('debugger', () => {

  describe('active sessions', () => {
    let session;

    beforeEach(() => {
      session = new Session();
      addSession(session);
    });

    afterEach(sessions.clearActiveSessions);

    describe('findSession', () => {
      it('finds session by id', () => {
        expect(findSession(session.getId())).to.equal(session);
      });
    });

    describe('removeSession', () => {
      it('removes session by id', () => {
        removeSession(session.getId());
        expect(findSession(session.getId())).to.be.null;
      });
    });
  });

  describe('Session', () => {
    let session;

    beforeEach(() => session = new Session());

    it('has an associated session id (UUID)', () => {
      const pattern =
        /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
      expect(pattern.test(session.getId())).to.be.true;
    });

    describe('script timeout', () => {
      it('is 30,000 milliseconds by default', () => {
        expect(session.getScriptTimeout()).to.equal(30000);
      });

      it('can be set to other values', () => {
        session.setScriptTimeout(10000);
        expect(session.getScriptTimeout()).to.equal(10000);
      });

      it('throws error if not set to a number', () => {
        expect(() => session.setScriptTimeout('10000')).to.throw(/must be a number/i);
      });
    });

    describe('page load timeout', () => {
      it('is 300,000 milliseconds by default', () => {
        expect(session.getPageLoadTimeout()).to.equal(300000);
      });

      it('can be set to other values', () => {
        session.setPageLoadTimeout(10000);
        expect(session.getPageLoadTimeout()).to.equal(10000);
      });

      it('throws error if not set to a number', () => {
        expect(() => session.setPageLoadTimeout('10000')).to.throw(/must be a number/i);
      });
    });

    describe('implicit wait timeout', () => {
      it('is 0 milliseconds by default', () => {
        expect(session.getImplicitWaitTimeout()).to.equal(0);
      });

      it('can be set to other values', () => {
        session.setImplicitWaitTimeout(10000);
        expect(session.getImplicitWaitTimeout()).to.equal(10000);
      });

      it('throws error if not set to a number', () => {
        expect(() => session.setImplicitWaitTimeout('10000')).to.throw(/must be a number/i);
      });
    });

    describe('page load strategy', () => {
      const PageLoadStrategy = require('./navigation_tracker').PageLoadStrategy;

      it('is normal by default', () => {
        expect(session.getPageLoadStrategy()).to.equal(PageLoadStrategy.NORMAL);
      });

      it('can be set to other strategies', () => {
        session.setPageLoadStrategy(PageLoadStrategy.NONE);
        expect(session.getPageLoadStrategy()).to.equal(PageLoadStrategy.NONE);
      });
    });

    describe('secure SSL state', () => {
      it('is true by default', () => {
        expect(session.getSecureSsl()).to.equal(true);
      });

      it('can be set through `acceptSslCerts`', () => {
        session.acceptSslCerts(true);
        expect(session.getSecureSsl()).to.equal(false);
      });
    });


    describe('tabs', () => {
      const tabsData = [
        { id: 1 },
        { id: 2 },
        { id: 3 }
      ];

      let list;

      beforeEach(() => {
        // track tabsData

        list = sinon.stub().returns(Promise.resolve([]));

        return session.trackTabs(list, () => list.returns(Promise.resolve(tabsData)));
      });

      describe('trackTabs', () => {
        const updatedTabsData = [
          { id: 2 },
          { id: 3 },
          { id: 4 }
        ];

        it('removes closed tabs from tracking tabs', () => {
          return session.trackTabs(list, () => list.returns(Promise.resolve(updatedTabsData)))
            .then(() => expect(session.getTabById(1)).to.be.null);
        });

        it('adds newly-opened tabs to tracking tabs', () => {
          return session.trackTabs(list, () => list.returns(Promise.resolve(updatedTabsData)))
            .then(() => expect(session.getTabById(4)).not.to.be.null);
        });
      });

      describe('getTabIds', () => {
        it('returns tab ids', () => {
          let tabIds = session.getTabIds();
          expect(tabIds).to.deep.equal(tabsData.map(tabData => tabData.id));
        });
      });

      describe('getFirstTab', () => {
        it('returns the first tab id', () => {
          let tab = session.getFirstTab();
          expect(tab.getId()).to.equal(tabsData[0].id);
        });
      });

      describe('setCurrentTabId', () => {
        it('sets the current tab id', () => {
          let id = session.getFirstTab().getId();

          session.setCurrentTabId(id);
          expect(session.currentTabId_).to.equal(id);
        });
      });

      describe('getCurrentTab', () => {
        it('returns current tab', () => {
          let id = session.getFirstTab().getId();
          session.setCurrentTabId(id);

          expect(session.getCurrentTab().getId()).to.equal(id);
        });

        it('throws no such window error if cannot find current tab', () => {
          expect(() => session.getCurrentTab()).to.throw(error.NoSuchWindowError);
        });
      });
    });


    describe('frames', () => {
      const frameInfos = [
        new FrameInfo('',  '1', 'wd-1'),
        new FrameInfo('1', '2', 'wd-2'),
        new FrameInfo('2', '3', 'wd-3')
      ];

      beforeEach(() => session.frames = frameInfos.slice(0));

      describe('switchToTopFrame', () => {
        it('empties the frames array', () => {
          session.switchToTopFrame();
          expect(session.frames.length).to.equal(0);
        });
      });

      describe('switchToParentFrame', () => {
        it('removes a frame from the end of frames array', () => {
          session.switchToParentFrame();
          expect(session.getCurrentFrameId()).to.equal('2');
        });
      });

      describe('switchToSubFrame', () => {
        beforeEach(() => session.switchToSubFrame('4', 'wd-4'));

        it('appends the sub frame to the end of frames array', () => {
          let subFrame = session.frames[session.frames.length-1];
          expect(subFrame.frameId).to.equal('4');
        });

        it('set parent frame id', () => {
          let subFrame = session.frames[session.frames.length-1];
          expect(subFrame.parentFrameId).to.equal('3');
        });
      });

      describe('getCurrentFrameId', () => {
        it('returns frame id of the frame from the end of frames array', () => {
          expect(session.getCurrentFrameId()).to.equal('3');
        });

        it('returns "" for top frame', () => {
          session.frames = [];
          expect(session.getCurrentFrameId()).to.equal('');
        });
      });
    });

  });

});
