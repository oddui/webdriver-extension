'use strict';

const mocha = require('mocha');

mocha.setup({
  ui: 'bdd',
  timeout: 20000
});

require('../src/lib/builder.test.js');
require('../src/lib/chrome.test.js');
require('../src/lib/http.test.js');
require('../src/lib/index.test.js');
require('../src/lib/version.test.js');
require('../src/lib/extension/debugger.test.js');
require('../src/lib/extension/frame_tracker.test.js');
require('../src/lib/extension/index.test.js');
require('../src/lib/extension/javascript_dialog_manager.test.js');
require('../src/lib/extension/navigation_tracker.test.js');
require('../src/lib/extension/session_commands.test.js');
require('../src/lib/extension/session.test.js');
require('../src/lib/extension/tab.test.js');
require('../src/lib/extension/window_commands.test.js');

require('./e2e.js');

mocha.run();
