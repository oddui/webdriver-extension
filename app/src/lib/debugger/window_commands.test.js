'use strict';

const expect = require('chai').expect,
  error = require('selenium-webdriver/lib/error'),
  sessions = require('./session'),
  windowCommands = require('./window_commands'),
  { go, refresh } = windowCommands;

windowCommands.Debugger =  require('./client/fake');


describe('debugger', () => {
  let sessionId;

  beforeEach(() => {
    let session = new sessions.Session();
    sessionId = session.getId();

    sessions.addSession(session);
  });

  afterEach(() => sessions.clearActiveSessions());


  describe('go', () => {
    windowCommandSpecs(go);
  });


  describe('refresh', () => {
    windowCommandSpecs(refresh);
  });


  function windowCommandSpecs(command) {
    it('throws no such session error if cannot find session', () => {
      return command({})
        .catch(e => expect(e).to.be.instanceOf(error.NoSuchSessionError));
    });

    it('throws no such window error if tab is closed', () => {
      return command({ sessionId: sessionId })
        .catch(e => expect(e).to.be.instanceOf(error.NoSuchWindowError));
    });
  }

});
