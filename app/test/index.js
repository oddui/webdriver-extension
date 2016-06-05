require('!style!css!mocha/mocha.css');
require('mocha/mocha.js');

mocha.setup('bdd');

require('./spec/version_spec.js');

mocha.run();
