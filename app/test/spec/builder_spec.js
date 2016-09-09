'use strict';

const expect = require('chai').expect,
  sinon = require('sinon'),
  capabilities = require('selenium-webdriver/lib/capabilities'),
  Builder = require('../../src/lib/builder').Builder;


describe('Builder', function() {
  let builder;


  beforeEach(function() {
    builder = new Builder();
  });


  describe('usingServer', function() {
    it('sets server url', function() {
      const serverUrl = 'http://webdriver.local';
      builder.usingServer(serverUrl);

      expect(builder.getServerUrl()).to.equal(serverUrl);
    });
  });


  describe('withCapabilities', function() {
    it('converts argument to `capabilities.Capabilities`', function() {
      builder.withCapabilities({});
      expect(builder.getCapabilities()).to.be.instanceof(capabilities.Capabilities);
    });
  });


  describe('delegates capabilitis methods to the capabilities object', function() {
    [
      'setProxy',
      'setLoggingPrefs',
      'setEnableNativeEvents',
      'setScrollBehavior',
      'setAlertBehavior'
    ].forEach(function(method) {

      it(`${method}`, function() {
        let spy = sinon.spy(builder.getCapabilities(), method);

        builder[method]();
        expect(spy.called).to.be.true;
      });
    });
  });


  describe('build', function() {

    it('throws error if browser not set', function() {
      expect(builder.build.bind(builder)).to.throw(/browser must be a string/i);
    });

    describe('when server url is not set', function() {

      it('throws error for non-chrome browsers', function() {
        builder.forBrowser(capabilities.Browser.FIREFOX);
        expect(builder.build.bind(builder)).to.throw(/do not know how to build driver/i);
      });

      it('creates a `webdriver.WebDriver` instance with a `debugger.Executor` for chrome');
    });
  });

});
