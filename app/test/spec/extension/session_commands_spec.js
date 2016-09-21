'use strict';

const expect = require('chai').expect,
  error = require('selenium-webdriver/lib/error'),
  fakeChromeApi = require('./fake_chrome_api'),
  SessionCommands = require('../../../src/lib/extension/session_commands'),
  Session = SessionCommands.Session,
  findSession = SessionCommands.findSession,
  clearActiveSessions = SessionCommands.clearActiveSessions,
  newSession = SessionCommands.newSession;


describe('extension', function() {

  describe('active sessions', function() {
    const removeSession = SessionCommands.removeSession,
      addSession = SessionCommands.addSession;

    let session;

    beforeEach(function() {
      session = new Session();
      addSession(session);
    });

    afterEach(clearActiveSessions);

    it('findSession', function() {
      expect(findSession(session.getId())).to.equal(session);
    });

    it('removeSession', function() {
      removeSession(session.getId());
      expect(findSession(session.getId())).to.be.null;
    });
  });

  describe('Session', function() {
    let session;

    beforeEach(function() {
      session = new Session();
    });

    it('has an associated session id (UUID)', function() {
      const pattern =
        /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
      expect(pattern.test(session.getId())).to.be.true;
    });

    describe('script timeout', function() {

      it('is 30,000 milliseconds by default', function() {
        expect(session.getScriptTimeout()).to.equal(30000);
      });

      it('can be set to other values', function() {
        session.setScriptTimeout(10000);
        expect(session.getScriptTimeout()).to.equal(10000);
      });

      it('throws error if not set to a number', function() {
        expect(function() {
          session.setScriptTimeout('10000');
        }).to.throw(/must be a number/i);
      });
    });

    describe('page load timeout', function() {

      it('is 300,000 milliseconds by default', function() {
        expect(session.getPageLoadTimeout()).to.equal(300000);
      });

      it('can be set to other values', function() {
        session.setPageLoadTimeout(10000);
        expect(session.getPageLoadTimeout()).to.equal(10000);
      });

      it('throws error if not set to a number', function() {
        expect(function() {
          session.setPageLoadTimeout('10000');
        }).to.throw(/must be a number/i);
      });
    });

    describe('implicit wait timeout', function() {

      it('is 0 milliseconds by default', function() {
        expect(session.getImplicitWaitTimeout()).to.equal(0);
      });

      it('can be set to other values', function() {
        session.setImplicitWaitTimeout(10000);
        expect(session.getImplicitWaitTimeout()).to.equal(10000);
      });

      it('throws error if not set to a number', function() {
        expect(function() {
          session.setImplicitWaitTimeout('10000');
        }).to.throw(/must be a number/i);
      });
    });

    describe('page load strategy', function() {
      const PageLoadStrategy = SessionCommands.PageLoadStrategy;

      it('is normal by default', function() {
        expect(session.getPageLoadStrategy()).to.equal(PageLoadStrategy.NORMAL);
      });

      it('can be set to other strategies', function() {
        session.setPageLoadStrategy(PageLoadStrategy.NONE);
        expect(session.getPageLoadStrategy()).to.equal(PageLoadStrategy.NONE);
      });

      it('throws error if set to non-supported strategies', function() {
        expect(function() {
          session.setPageLoadStrategy('not-supported');
        }).to.throw(/not supported/i);
      });
    });

    describe('secure SSL state', function() {

      it('is true by default', function() {
        expect(session.getSecureSsl()).to.equal(true);
      });

      it('can be set through `acceptSslCerts`', function() {
        session.acceptSslCerts(true);
        expect(session.getSecureSsl()).to.equal(false);
      });
    });
  });


  describe('newSession', function() {

    before(fakeChromeApi.use);
    after(fakeChromeApi.restore);

    afterEach(clearActiveSessions);

    it('throws session not created if reached maximum active sessions', function() {
      let promises = [];

      for (let i = 0; i < SessionCommands.MAXIMUM_ACTIVE_SESSIONS; i++) {
        promises.push(newSession({ desiredCapabilities: {} }));
      }

      return Promise.all(promises)
        .then(function() {
          return newSession()
            .catch(function(e) {
              expect(e).to.be.instanceof(error.SessionNotCreatedError);
            });
        });
    });

    it('adds new session in active sessions', function() {
      return newSession({ desiredCapabilities: {} })
        .then(function(result) {
          expect(result).to.have.property('sessionId');
          expect(result).to.have.property('capabilities');

          expect(findSession(result.sessionId).sessionId).to.equal(result.sessionid);
        });
    });

    describe('capabilities', function() {

      it('throws session not created if desiredCapabilities not passed in', function() {
        return newSession()
          .catch(function(e) {
            expect(e).to.be.instanceof(error.SessionNotCreatedError);
          });
      });

      it('throws session not created if required capabilities cannot be met', function() {
        return newSession({
          capabilities: {
            requiredCapabilities: {
              browserName: 'safari'
            },
            desiredCapabilities: {}
          }
        })
          .catch(function(e) {
            expect(e).to.be.instanceof(error.SessionNotCreatedError);
            expect(e.message).to.be.match(/does not match server capability/i);
          });
      });

      it('throws session not created if required capability is unknown', function() {
        return newSession({
          capabilities: {
            requiredCapabilities: {
              unknown: true
            },
            desiredCapabilities: {}
          }
        })
          .catch(function(e) {
            expect(e).to.be.instanceof(error.SessionNotCreatedError);
            expect(e.message).to.be.match(/unknown required capability/i);
          });
      });

    });
  });

});
