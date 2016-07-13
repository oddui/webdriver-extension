'use strict';

const expect = require('chai').expect,
  proxy = require('selenium-webdriver/lib/proxy'),
  symbols = require('selenium-webdriver/lib/symbols'),
  capabilities = require('selenium-webdriver/lib/capabilities'),
  Capabilities = capabilities.Capabilities,
  Capability = capabilities.Capability,
  chrome = require('../../src/lib/chrome'),
  Options = chrome.Options;


describe('chrome', function() {

  it('exports Option', function() {
    expect(chrome.Options).not.to.be.undefined;
  });


  describe('chrome.Options', function() {

    describe('fromCapabilities', function() {
      it('returns a new Options instance if none was defined', function() {
        let options = Options.fromCapabilities(new Capabilities());
        expect(options).to.be.instanceOf(Options);
      });

      it('returns Options instance if present', function() {
        let options = new Options(),
          caps = options.toCapabilities();
        expect(caps).to.be.instanceOf(Capabilities);
        expect(Options.fromCapabilities(caps)).to.equal(options);
      });

      it('rebuilds options from wire representation', function() {
        const caps = Capabilities.chrome().set('chromeOptions', {
          args: ['a', 'b'],
          binary: 'binaryPath',
          detach: true,
          extensions: ['extensionFilePath'],
          localState: 'localStateValue',
          logPath: 'logFilePath',
          prefs: 'prefsValue'
        });

        let options = Options.fromCapabilities(caps);

        expect(options.extensions_.length).to.equal(1);
        expect(options.extensions_[0]).to.equal('extensionFilePath');
        expect(options.options_.args.length).to.equal(2);
        expect(options.options_.args[0]).to.equal('a');
        expect(options.options_.args[1]).to.equal('b');
        expect(options.options_.binary).to.equal('binaryPath');
        expect(options.options_.detach).to.equal(true);
        expect(options.options_.localState).to.equal('localStateValue');
        expect(options.options_.logPath).to.equal('logFilePath');
        expect(options.options_.prefs).to.equal('prefsValue');
      });

      it('rebuilds options from incomplete wire representation', function() {
        const caps = Capabilities.chrome().set('chromeOptions', {
          logPath: 'logFilePath'
        });

        let options = Options.fromCapabilities(caps);

        expect(options.extensions_.length).to.equal(0);
        expect(options.options_.args).to.be.undefined;
        expect(options.options_.binary).to.be.undefined;
        expect(options.options_.detach).to.be.undefined;
        expect(options.options_.excludeSwitches).to.be.undefined;
        expect(options.options_.localState).to.be.undefined;
        expect(options.options_.logPath).to.equal('logFilePath');
        expect(options.options_.minidumpPath).to.be.undefined;
        expect(options.options_.mobileEmulation).to.be.undefined;
        expect(options.options_.perfLoggingPrefs).to.be.undefined;
        expect(options.options_.prefs).to.be.undefined;
      });

      it('extracts supported WebDriver capabilities', function() {
        const proxyPrefs = proxy.direct(),
          logPrefs = {},
          caps = Capabilities.chrome()
            .set(Capability.PROXY, proxyPrefs)
            .set(Capability.LOGGING_PREFS, logPrefs);

        let options = Options.fromCapabilities(caps);

        expect(options.proxy_).to.equal(proxyPrefs);
        expect(options.logPrefs_).to.equal(logPrefs);
      });
    });


    describe('addArguments', function() {
      it('takes var_args', function() {
        let options = new Options();
        expect(options[symbols.serialize]().args).to.be.undefined;

        options.addArguments('a', 'b');
        let json = options[symbols.serialize]();
        expect(json.args.length).to.equal(2);
        expect(json.args[0]).to.equal('a');
        expect(json.args[1]).to.equal('b');
      });

      it('flattens input arrays', function() {
        let options = new Options();
        expect(options[symbols.serialize]().args).to.be.undefined;

        options.addArguments(['a', 'b'], 'c', [1, 2], 3);
        let json = options[symbols.serialize]();
        expect(json.args.length).to.equal(6);
        expect(json.args[0]).to.equal('a');
        expect(json.args[1]).to.equal('b');
        expect(json.args[2]).to.equal('c');
        expect(json.args[3]).to.equal(1);
        expect(json.args[4]).to.equal(2);
        expect(json.args[5]).to.equal(3);
      });
    });


    describe('addExtensions', function() {
      it('takes var_args', function() {
        let options = new Options();
        expect(options.extensions_.length).to.equal(0);

        options.addExtensions('a', 'b');
        expect(options.extensions_.length).to.equal(2);
        expect(options.extensions_[0]).to.equal('a');
        expect(options.extensions_[1]).to.equal('b');
      });

      it('flattens input arrays', function() {
        let options = new Options();
        expect(options.extensions_.length).to.equal(0);

        options.addExtensions(['a', 'b'], 'c', [1, 2], 3);
        expect(options.extensions_.length).to.equal(6);
        expect(options.extensions_[0]).to.equal('a');
        expect(options.extensions_[1]).to.equal('b');
        expect(options.extensions_[2]).to.equal('c');
        expect(options.extensions_[3]).to.equal(1);
        expect(options.extensions_[4]).to.equal(2);
        expect(options.extensions_[5]).to.equal(3);
      });
    });


    describe('serialize', function() {
      it('does not support base64 encodes extensions', function() {
        var json = new Options().addExtensions('extensionFilePath')[symbols.serialize]();
        expect(json.extensions.length).to.equal(1);
        expect(json.extensions[0]).to.be.undefined;
      });
    });


    describe('toCapabilities', function() {
      it('returns a new capabilities object if one is not provided', function() {
        let options = new Options(),
          caps = options.toCapabilities();

        expect(caps.get('browserName')).to.equal('chrome');
        expect(caps.get('chromeOptions')).to.equal(options);
      });

      it('adds to input capabilities object', function() {
        let caps = Capabilities.firefox(),
          options = new chrome.Options();

        expect(options.toCapabilities(caps)).to.equal(caps);
        expect(caps.get('browserName')).to.equal('firefox');
        expect(caps.get('chromeOptions')).to.equal(options);
      });

      it('sets generic driver capabilities', function() {
        let proxyPrefs = {},
          loggingPrefs = {},
          options = new chrome.Options()
            .setLoggingPrefs(loggingPrefs)
            .setProxy(proxyPrefs),
          caps = options.toCapabilities();

        expect(caps.get('proxy')).to.equal(proxyPrefs);
        expect(caps.get('loggingPrefs')).to.equal(loggingPrefs);
      });
    });

  });

});
