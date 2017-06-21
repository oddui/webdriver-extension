'use strict';

const expect = require('chai').expect,
  error = require('selenium-webdriver/lib/error'),
  fakeChromeApi = require('./fake_chrome_api'),
  sessions = require('./session'),
  { newSession, deleteSession, MAXIMUM_ACTIVE_SESSIONS } = require('./session_commands');


describe('extension', () => {

  before(fakeChromeApi.use);
  after(fakeChromeApi.restore);

  afterEach(sessions.clearActiveSessions);

  describe('newSession', () => {
    it('throws session not created if reached maximum active sessions', () => {
      let promises = [];

      for (let i = 0; i < MAXIMUM_ACTIVE_SESSIONS; i++) {
        promises.push(newSession({ desiredCapabilities: {} }));
      }

      return Promise.all(promises)
        .then(() => {
          return newSession()
            .catch(e => expect(e).to.be.instanceof(error.SessionNotCreatedError));
        });
    });

    it('adds new session in active sessions', () => {
      return newSession({ desiredCapabilities: {} })
        .then(result => {
          expect(result).to.have.property('sessionId');
          expect(result).to.have.property('capabilities');

          expect(sessions.findSession(result.sessionId).getId()).to.equal(result.sessionId);
        });
    });

    describe('capabilities', () => {
      it('throws session not created if desiredCapabilities not passed in', () => {
        return newSession()
          .catch(e => expect(e).to.be.instanceof(error.SessionNotCreatedError));
      });

      it('throws session not created if required capabilities cannot be met', () => {
        return newSession({
          capabilities: {
            requiredCapabilities: {
              browserName: 'safari'
            },
            desiredCapabilities: {}
          }
        })
          .catch(e => {
            expect(e).to.be.instanceof(error.SessionNotCreatedError);
            expect(e.message).to.be.match(/does not match server capability/i);
          });
      });

      it('throws session not created if required capability is unknown', () => {
        return newSession({
          capabilities: {
            requiredCapabilities: {
              unknown: true
            },
            desiredCapabilities: {}
          }
        })
          .catch(e => {
            expect(e).to.be.instanceof(error.SessionNotCreatedError);
            expect(e.message).to.be.match(/unknown required capability/i);
          });
      });
    });
  });


  describe('deleteSession', () => {
    it('throws no such session error if cannot find session with id', () => {
      return deleteSession({ sessionId: -1 })
        .catch(e => expect(e).to.be.instanceof(error.NoSuchSessionError));
    });

    it('removes session from active sessions', () => {
      let session = new sessions.Session();
      sessions.addSession(session);

      return deleteSession({ sessionId: session.getId() })
        .then(() => expect(sessions.findSession(session.getId())).to.be.null);
    });
  });

});
