'use strict';

const http = require('selenium-webdriver/lib/http');

// URLs regexp copied from angular.js, see:
// https://github.com/angular/angular.js/blob/v1.5.0/src/ng/directive/input.js#L26
const URL_REGEXP = /^[a-z][a-z\d.+-]*:\/*(?:[^:@]+(?::[^@]+)?@)?(?:[^\s:/?#]+|\[[a-f\d:]+\])(?::\d+)?(?:\/[^?#]*)?(?:\?[^#]*)?(?:#.*)?$/i;

/**
 * Builds a {@link Response} from a {@link XMLHttpRequest} object.
 * @param {!XMLHttpRequest} xhr The request to parse.
 * @return {!Response} The parsed response.
 */
function fromXhr(xhr) {
  var headers = {};

  var tmp = xhr.getAllResponseHeaders();
  if (tmp) {
    tmp = tmp.replace(/\r\n/g, '\n').split('\n');
    tmp.forEach(function(header) {
      var parts = header.split(/\s*:\s*/, 2);
      if (parts[0]) {
        headers[parts[0]] = parts[1] || '';
      }
    });
  }

  return new http.Response(xhr.status, headers, xhr.responseText.replace(/\0/g, ''));
}


/**
 * An XMLHttpRequest based HTTP client.
 *
 * @implements {http.Client}
 * @param {string} serverUrl URL for the WebDriver server to send commands to.
 * @constructor
 */
function HttpClient(serverUrl) {
  if (!URL_REGEXP.test(serverUrl)) {
    throw new Error(`Invalid server URL: ${serverUrl}`);
  }

  /** @private */
  this.url_ = serverUrl;
}


/**
 * Sends a request to the server. The client will automatically follow any
 * redirects returned by the server, resolving the returned promise with the
 * final response.
 *
 * @override
 * @param {!Request} request The request to send.
 * @return {!Promise<Response>} A promise that will be resolved with
 *     the server's response.
 */
HttpClient.prototype.send = function(request) {
  var url;

  if (this.url_[this.url_.length - 1] === '/' && request.path[0] === '/') {
    url = this.url_ + request.path.substring(1);
  } else {
    url = this.url_ + request.path;
  }

  return new Promise(function(resolve, reject) {
    var xhr = new XMLHttpRequest();
    xhr.open(request.method, url, true);

    xhr.onload = function() {
      resolve(fromXhr(xhr));
    };

    xhr.onerror = function() {
      var message = [
        `Unable to send request: ${request.method} ${url}`,
        'Original request:',
        request
      ].join('\n');

      reject(new Error(message));
    };

    request.headers.forEach(function(value, name) {
      xhr.setRequestHeader(name, value);
    });

    if (['POST', 'PUT'].indexOf(request.method) > -1) {
      xhr.setRequestHeader('Content-Type', 'application/json; charset=UTF-8');
      xhr.send(JSON.stringify(request.data));
    } else {
      xhr.send();
    }
  });
};


module.exports = {
  fromXhr: fromXhr,
  Request: http.Request,
  Response: http.Response,
  Executor: http.Executor,
  Client: HttpClient
};
