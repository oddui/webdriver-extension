'use strict';

const expect = require('chai').expect,
  sinon =  require('sinon'),
  http = require('../../src/lib/http'),
  fromXhr = http.fromXhr,
  Request = http.Request,
  Response = http.Response,
  HttpClient = http.Client;


describe('http', function() {

  ['Request', 'Response', 'Executor', 'Client'].forEach(function(func) {
    it(`exports ${func}`, function() {
      expect(http[func]).not.to.be.undefined;
    });
  });

  describe('fromXhr', function() {
    let mockXhr;

    beforeEach(function() {
      mockXhr = {
        status: 200,
        responseText: '',
        getAllResponseHeaders: sinon.spy()
      };
    });

    it('sets status', function() {
      let response = fromXhr(mockXhr);
      expect(response.status).to.equal(mockXhr.status);
    });

    it('strips null characters from response body', function() {
      mockXhr.responseText = '\x00foo\x00\x00bar\x00';

      let response = fromXhr(mockXhr);
      expect(response.body).to.equal('foobar');
    });

    describe('parses headers', function() {
      let headers, parsedHeaders;

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

        let response = fromXhr(mockXhr);
        expect(object(response.headers)).to.eql(parsedHeaders);
      });

      it('unix', function() {
        mockXhr.getAllResponseHeaders = sinon.stub().returns(headers.join('\n'));

        let response = fromXhr(mockXhr);
        expect(object(response.headers)).to.eql(parsedHeaders);
      });

      it('handles response with no headers', function() {
        mockXhr.getAllResponseHeaders = sinon.stub().returns('');

        let response = fromXhr(mockXhr);
        expect(response.headers).to.eql({});
      });

      function object(map) {
        let object = {};
        for (let entry of map) {
          object[entry[0]] = entry[1];
        }
        return object;
      }
    });
  });

  describe('HttpClient', function() {
    const serverUrl = 'http://webdriver.local';

    let FakeXhr, xhrq, httpClient, request;

    before(function() {
      FakeXhr = sinon.useFakeXMLHttpRequest();
      global.XMLHttpRequest = FakeXhr;

      xhrq = [];
      FakeXhr.onCreate = function(xhr) {
        xhrq.push(xhr);
      };
    });

    after(function() {
      FakeXhr.restore();
    });

    beforeEach(function() {
      xhrq.length = 0;

      httpClient = new HttpClient(serverUrl);
      request = new Request('GET', '/path');
    });

    describe('constructor', function() {
      it('throws error if serverUrl is invalid', function() {
        expect(function() {
          new HttpClient('invalid.url');
        }).to.throw(/invalid server url/i);
      });
    });

    describe('#send()', function() {

      it('trims request path leading "/" if needed', function() {
        new HttpClient(`${serverUrl}/`).send(request);
        expect(xhrq[0].url).to.equal(`${serverUrl}${request.path}`);
      });

      it('sets headers from `Request#headers`', function() {
        request.headers.set('X-Header', 'Value');
        new HttpClient(`${serverUrl}/`).send(request);

        request.headers.forEach(function(value, name) {
          expect(xhrq[0].requestHeaders[name] === value);
        });
      });

      ['POST', 'PUT'].forEach(function(method) {
        it(`sets "Content-Type" header to json for ${method}`, function() {
          httpClient.send(new Request(method, '/path', {}));
          expect(xhrq[0].requestHeaders['Content-Type']).to.match(/json/i);
          expect(xhrq[0].requestBody).to.equal(JSON.stringify({}));
        });
      });

      ['GET', 'PATCH', 'DELETE'].forEach(function(method) {
        it(`does not send request body for ${method}`, function() {
          httpClient.send(new Request(method, '/path', {}));
          expect(xhrq[0].requestBody).to.oneOf([null, undefined]);
        });
      });

      it('returns promise resolving the response', function(done) {
        httpClient.send(request)
        .then(function(res) {
          expect(res).to.be.instanceOf(Response);
          expect(res.body).to.equal('OK');

          done();
        });

        xhrq[0].respond(200, {}, 'OK');
      });

      it('returns promise rejecting with an error if unable to send', function(done) {
        httpClient.send(request)
        .catch(function(e) {
          expect(e.message).to.match(/^unable to send request/i);

          done();
        });

        xhrq[0].error();
      });
    });
  });

});
