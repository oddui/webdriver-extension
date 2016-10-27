'use strict';

const expect = require('chai').expect,
  error = require('selenium-webdriver/lib/error'),
  fakeChromeApi = require('./fake_chrome_api'),
  sessions = require('../../../src/lib/extension/session'),
  Session = sessions.Session,
  FrameInfo = sessions.FrameInfo,
  addSession = sessions.addSession,
  findSession = sessions.findSession,
  removeSession = sessions.removeSession;


describe('extension', () => {

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
      const PageLoadStrategy = sessions.PageLoadStrategy;

      it('is normal by default', () => {
        expect(session.getPageLoadStrategy()).to.equal(PageLoadStrategy.NORMAL);
      });

      it('can be set to other strategies', () => {
        session.setPageLoadStrategy(PageLoadStrategy.NONE);
        expect(session.getPageLoadStrategy()).to.equal(PageLoadStrategy.NONE);
      });

      it('throws error if set to non-supported strategies', () => {
        expect(() => session.setPageLoadStrategy('not-supported')).to.throw(/not supported/i);
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

      before(fakeChromeApi.use);
      after(fakeChromeApi.restore);

      beforeEach(() => chrome.tabs.setTabs(tabsData.slice(0)));

      describe('updateTabs_', () => {
        const updatedTabsData = [
          { id: 2 },
          { id: 3 },
          { id: 4 }
        ];

        beforeEach(() => chrome.tabs.setTabs(updatedTabsData));

        it('removes closed tabs', () => {
          return session.updateTabs_()
            .then(() => {
              expect(session.getTabById(1)).to.be.null;
            });
        });

        it('adds newly-opened tabs', () => {
          return session.updateTabs_()
            .then(() => {
              expect(session.getTabById(4)).not.to.be.null;
            });
        });
      });

      describe('getTabIds', () => {
        it('updates tabs and returns tab ids', () => {
          return session.getTabIds()
            .then(tabIds => {
              expect(tabIds).to.deep.equal(tabsData.map(tabData => tabData.id));
            });
        });
      });

      describe('getFirstTabId', () => {
        it('updates tabs and returns the first tab id', () => {
          return session.getFirstTabId()
            .then(id => {
              expect(id).to.equal(tabsData[0].id);
            });
        });
      });

      describe('closeTab', () => {
        it('closes the tab in chrome and removes it from tracking tabs', () => {
          return session.getFirstTabId()
            .then(id => {
              return session.closeTab(id)
                .then(() => {
                  return new Promise(resolve => chrome.tabs.query({}, resolve));
                })
                .then(tabsData => {
                  expect(tabsData.map(tabData => tabData.id)).not.to.include(id);
                  expect(session.getTabById(id)).to.be.null;
                });
            });
        });
      });

      describe('setTargetTabId', () => {
        it('sets target tab id', () => {
          return session.getFirstTabId()
            .then(id => {
              session.setTargetTabId(id);
              expect(session.targetTabId_).to.equal(id);
            });
        });
      });

      describe('getTargetTab', () => {
        it('gets target tab by target tab id', () => {
          return session.getFirstTabId()
            .then(id => {
              session.setTargetTabId(id);
              expect(session.getTargetTab().getId()).to.equal(id);
            });
        });

        it('throws no such window error if cannot find tab by target tab id', () => {
          expect(() => session.getTargetTab(-1)).to.throw(error.NoSuchWindowError);
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
