'use strict';

const expect = require('chai').expect,
  error = require('selenium-webdriver/lib/error'),
  fakeChromeApi = require('./fake_chrome_api'),
  SessionCommands = require('../../../src/lib/extension/session_commands'),
  Session = SessionCommands.Session,
  clearSessions = SessionCommands.clearSessions,
  findSession = SessionCommands.findSession,
  newSession = SessionCommands.newSession;


describe('extension', function() {

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

    afterEach(clearSessions);

    it('adds new session in active sessions', function() {
      return newSession()
        .then(function(result) {
          expect(findSession(result.sessionId)).not.to.be.null;
        });
    });

    it('throws session not created error if reached maximum active sessions', function() {
      let promises = [];

      for (let i = 0; i < SessionCommands.MAXIMUM_ACTIVE_SESSIONS; i++) {
        promises.push(newSession());
      }

      return newSession()
        .catch(function(e) {
          expect(e).to.be.instanceof(error.SessionNotCreatedError);
        });
    });
  });

});
