'use strict';

const mocha = require('mocha');

mocha.setup('bdd');

require('./spec/version_spec.js');
require('./spec/http_spec.js');

mocha.run();
