'use strict';

const expect = require('chai').expect,
  cmd = require('selenium-webdriver/lib/command'),
  error = require('selenium-webdriver/lib/error'),
  fakeChromeApi = require('./fake_chrome_api'),
  Executor = require('../../../src/lib/extension').Executor;


describe('extension', function() {

  describe('Executor', function() {

    let executor;

    before(fakeChromeApi.use);
    after(fakeChromeApi.restore);

    beforeEach(function() {
      executor = new Executor();
    });

    describe('execute', function() {

      it('throws error if executing non-supported command', function() {
        expect(function() {
          executor.execute(new cmd.Command('work'));
        }).to.throw(error.UnknownCommandError);
      });
    });
  });

});
