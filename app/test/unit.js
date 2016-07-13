'use strict';

const mocha = require('mocha');

mocha.setup('bdd');

require('./spec/version_spec.js');
require('./spec/http_spec.js');
require('./spec/chrome_spec.js');
require('./spec/index_spec.js');

mocha.run();
