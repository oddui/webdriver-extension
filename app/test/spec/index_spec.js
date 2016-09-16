var expect = require('chai').expect,
  index = require('../../src/lib/index');

describe('index', function() {
  ['version', 'Builder', 'By', 'until', 'logging'].forEach(function(func) {
    it(`exports ${func}`, function() {
      expect(index[func]).not.to.be.undefined;
    });
  });
});
