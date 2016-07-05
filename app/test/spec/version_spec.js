var expect = require('chai').expect,
  semver = require('semver'),
  version = require('../../src/lib/version');

describe('version', function () {
  it('is SemVer', function () {
    expect(version).to.be.instanceOf(semver.SemVer);
  });
  it('defines webdriver (selenium-webdriver) version', function () {
    expect(version['webdriver-version']).not.to.be.undefined;
  });
});
