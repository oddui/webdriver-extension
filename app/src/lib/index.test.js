var expect = require('chai').expect,
  index = require('./index'),
  promise = require('selenium-webdriver/lib/promise');

describe('index', () => {
  ['version', 'Builder', 'By', 'until', 'logging'].forEach(func => {
    it(`exports ${func}`, () => {
      expect(index[func]).not.to.be.undefined;
    });
  });

  it('promise manager is disabled', () => {
    expect(promise.USE_PROMISE_MANAGER).to.be.false;
  });
});
