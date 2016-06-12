/**
 * Converts a headers object to a HTTP header block string.
 * @param {!Object.<string, string>} headers The headers object to convert.
 * @return {string} The headers as a string.
 * @private
 */
function headersToString_(headers) {
  var ret = [];
  for (var key in headers) {
    ret.push(key + ': ' + headers[key]);
  }
  return ret.join('\n');
}



/**
 * Describes a partial HTTP request. This class is a "partial" request and only
 * defines the path on the server to send a request to. It is each
 * {@link webdriver.http.Client}'s responsibility to build the full URL for the
 * final request.
 * @param {!string} method The HTTP method to use for the request.
 * @param {!string} path Path on the server to send the request to.
 * @param {Object} opt_data This request's JSON data.
 * @constructor
 */
function HttpRequest(method, path, opt_data) {

  /**
   * The HTTP method to use for the request.
   * @type {!string}
   */
  this.method = method;

  /**
   * The path on the server to send the request to.
   * @type {!string}
   */
  this.path = path;

  /**
   * This request's body.
   * @type {Object}
   */
  this.data = opt_data;

  /**
   * The headers to send with the request.
   * @type {!Object.<string, string>}
   */
  this.headers = {'Accept': 'application/json; charset=UTF-8'};
}


/** @override */
HttpRequest.prototype.toString = function() {
  var ret = [
    `${this.method} ${this.path} HTTP/1.1`,
    headersToString_(this.headers)
  ];

  if (this.data) {
    ret.push('');
    ret.push(JSON.stringify(this.data));
  }

  return ret.join('\n');
};



/**
 * Represents a HTTP response.
 * @param {!number} status The response code.
 * @param {!Object.<string>} headers The response headers. All header
 *     names will be converted to lowercase strings for consistent lookups.
 * @param {string} body The response body.
 * @constructor
 */
function HttpResponse(status, headers, body) {

  /**
   * The HTTP response code.
   * @type {!number}
   */
  this.status = status;

  /**
   * The response body.
   * @type {string}
   */
  this.body = body;

  /**
   * The response headers.
   * @type {!Object.<string, string>}
   */
  this.headers = {};
  for (var header in headers) {
    this.headers[header.toLowerCase()] = headers[header];
  }
}


/**
 * Builds a {@link HttpResponse} from a {@link XMLHttpRequest} response object.
 * @param {!XMLHttpRequest} xhr The request to parse.
 * @return {!HttpResponse} The parsed response.
 */
HttpResponse.fromXhr = function(xhr) {
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

  return new HttpResponse(xhr.status, headers, xhr.responseText.replace(/\0/g, ''));
};


/** @override */
HttpResponse.prototype.toString = function() {
  var headers = headersToString_(this.headers);
  var ret = ['HTTP/1.1 ' + this.status, headers];

  if (headers) {
    ret.push('');
  }

  if (this.body) {
    ret.push(this.body);
  }

  return ret.join('\n');
};


// TODO: require HttpRequest/HttpResponse from selenium-webdriver lib/http

// URLs regexp copied from angular.js, see:
// https://github.com/angular/angular.js/blob/v1.5.0/src/ng/directive/input.js#L26
const URL_REGEXP = /^[a-z][a-z\d.+-]*:\/*(?:[^:@]+(?::[^@]+)?@)?(?:[^\s:/?#]+|\[[a-f\d:]+\])(?::\d+)?(?:\/[^?#]*)?(?:\?[^#]*)?(?:#.*)?$/i;

/**
 * An XMLHttpRequest based HTTP client.
 *
 * @implements {http.Client}
 * @param {!string} serverUrl URL for the WebDriver server to send commands to.
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
 * @param {!HttpRequest} request The request to send.
 * @return {!Promise<HttpResponse>} A promise that will be resolved with
 *   the server's response.
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
      resolve(HttpResponse.fromXhr(xhr));
    };

    xhr.onerror = function() {
      var message = [
        `Unable to send request: ${request.method} ${url}`,
        'Original request:',
        request
      ].join('\n');

      reject(new Error(message));
    };

    for (var header in request.headers) {
      xhr.setRequestHeader(header, request.headers[header] + '');
    }

    if (request.method == 'POST' || request.method == 'PUT') {
      xhr.setRequestHeader('Content-Type', 'application/json; charset=UTF-8');
    }

    xhr.send(JSON.stringify(request.data));
  });
};


module.exports = {
  HttpRequest: HttpRequest,
  HttpResponse: HttpResponse,
  HttpClient: HttpClient
};
