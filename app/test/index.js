'use strict';

const mocha = require('mocha');

mocha.setup({
  ui: 'bdd',
  timeout: 20000
});

require('./spec/builder_spec.js');
require('./spec/chrome_spec.js');
require('./spec/http_spec.js');
require('./spec/index_spec.js');
require('./spec/version_spec.js');
require('./spec/extension/debugger_spec.js');
require('./spec/extension/frame_tracker_spec.js');
require('./spec/extension/index_spec.js');
require('./spec/extension/session_commands_spec.js');
require('./spec/extension/session_spec.js');
require('./spec/extension/tab_spec.js');

require('./e2e.js');

mocha.run();
