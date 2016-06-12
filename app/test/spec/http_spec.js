var expect = require('chai').expect,
  sinon =  require('sinon'),
  http = require('../../scripts/lib/http'),
  HttpRequest = http.HttpRequest,
  HttpResponse = http.HttpResponse,
  HttpClient = http.HttpClient;

describe('HttpRequest', function() {
  var request, METHOD = 'GET', PATH = '/path';

  beforeEach(function() {
    request = new HttpRequest(METHOD, PATH);
  });

  it('sets method', function() {
    expect(request.method).to.equal(METHOD);
  });

  it('sets path', function() {
    expect(request.path).to.equal(PATH);
  });
});

describe('HttpResponse', function() {

  describe('fromXhr', function() {
    var mockXhr;

    beforeEach(function() {
      mockXhr = {
        status: 200,
        responseText: '',
        getAllResponseHeaders: sinon.spy()
      };
    });

    it('sets status', function() {
      var response = HttpResponse.fromXhr(mockXhr);
      expect(response.status).to.equal(mockXhr.status);
    });

    it('strips null characters from response body', function() {
      mockXhr.responseText = '\x00foo\x00\x00bar\x00';

      var response = HttpResponse.fromXhr(mockXhr);
      expect(response.body).to.equal('foobar');
    });

    describe('parses headers', function() {
      var headers, parsedHeaders;

      beforeEach(function() {
        headers = [
          'a:b',
          'c: d',
          'e :f',
          'g : h'
        ];
        parsedHeaders = {
          'a': 'b',
          'c': 'd',
          'e': 'f',
          'g': 'h'
        };
      });
      it('windows', function() {
        mockXhr.getAllResponseHeaders = sinon.stub().returns(headers.join('\r\n'));

        var response = HttpResponse.fromXhr(mockXhr);
        expect(response.headers).to.eql(parsedHeaders);
      });

      it('unix', function() {
        mockXhr.getAllResponseHeaders = sinon.stub().returns(headers.join('\n'));

        var response = HttpResponse.fromXhr(mockXhr);
        expect(response.headers).to.eql(parsedHeaders);
      });

      it('handles response with no headers', function() {
        mockXhr.getAllResponseHeaders = sinon.stub().returns('');

        var response = HttpResponse.fromXhr(mockXhr);
        expect(response.headers).to.eql({});
      });
    });
  });
});

describe('HttpClient', function() {
  var FakeXhr, requests, httpClient;

  before(function() {
    FakeXhr = sinon.useFakeXMLHttpRequest();
    global.XMLHttpRequest = FakeXhr;

    requests = [];
    FakeXhr.onCreate = function(xhr) {
      requests.push(xhr);
    };
  });

  after(function() {
    FakeXhr.restore();
    global.XMLHttpRequest = undefined;
  });

  beforeEach(function() {
    requests.length = 0;

    httpClient = new HttpClient('http://webdriver.local');
  });

  describe('constructor', function() {
    it('throws error if serverUrl is invalid', function() {
      expect(function() {
        new HttpClient('invalid.url');
      }).to.throw(/invalid server url/i);
    });
  });

  describe('#send()', function() {

    it('returns promise resolving the response', function(done) {
      httpClient.send(new HttpRequest())
      .then(function(res) {
        expect(res).to.be.instanceOf(HttpResponse);
        expect(res.body).to.equal('OK');

        done();
      });

      requests[0].respond(200, {}, 'OK');
    });

    it('rejects with an error if somethings wrong');
  });
});
