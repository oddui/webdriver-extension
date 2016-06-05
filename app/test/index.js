require('!style!css!mocha/mocha.css');
require('mocha/mocha.js');

mocha.setup('bdd');

require('./spec/test.js');

mocha.run();
