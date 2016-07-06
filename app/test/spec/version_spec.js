var expect = require('chai').expect,
  semver = require('semver'),
  version = require('../../src/lib/version');

describe('version', function() {
  it('is SemVer', function() {
    expect(version).to.be.instanceOf(semver.SemVer);
  });
  it('defines selenium-webdriver version', function() {
    expect(version['selenium-webdriver']).be.equal(require('selenium-webdriver/package.json').version);
  });
});
