'use strict';

const mocha = require('mocha');

mocha.setup('bdd');

require('./spec/builder_spec.js');
require('./spec/chrome_spec.js');
require('./spec/http_spec.js');
require('./spec/index_spec.js');
require('./spec/version_spec.js');
require('./spec/extension/debugger_spec.js');
require('./spec/extension/index_spec.js');
require('./spec/extension/session_commands_spec.js');

mocha.run();
