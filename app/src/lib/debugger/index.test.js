'use strict';

const expect = require('chai').expect,
  cmd = require('selenium-webdriver/lib/command'),
  error = require('selenium-webdriver/lib/error'),
  Executor = require('./index').Executor;


describe('debugger', function() {

  describe('Executor', function() {

    let executor;

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
