'use strict';

require('style-loader!css-loader!mocha/mocha.css');
require('mocha/mocha.js');

const mocha = global.mocha;

mocha.setup({
  ui: 'bdd',
  timeout: 20000
});

require('../src/lib/builder.test.js');
require('../src/lib/chrome.test.js');
require('../src/lib/debugger/client/cri.test.js');
require('../src/lib/debugger/client/extension.test.js');
require('../src/lib/debugger/frame_tracker.test.js');
require('../src/lib/debugger/index.test.js');
require('../src/lib/debugger/javascript_dialog_manager.test.js');
require('../src/lib/debugger/navigation_tracker.test.js');
require('../src/lib/debugger/session.test.js');
require('../src/lib/debugger/session_commands.test.js');
require('../src/lib/debugger/tab.test.js');
require('../src/lib/debugger/window_commands.test.js');
require('../src/lib/http/index.test.js');
require('../src/lib/index.test.js');

require('./e2e.js');

mocha.run();
