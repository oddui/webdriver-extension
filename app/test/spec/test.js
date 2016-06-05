var expect = require('chai').expect,
  sinon = require('sinon');

describe('Give it some context', function () {
  describe('maybe a bit more context here', function () {
    it('should run here few assertions', function () {
      expect(sinon.spy).to.be.instanceOf(Function);
    });
  });
});
