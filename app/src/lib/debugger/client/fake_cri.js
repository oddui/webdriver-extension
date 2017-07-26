const EventEmitter = require('events');


class Chrome extends EventEmitter {

  static List() {
    return Promise.resolve([]);
  }

  static New() {
    return Promise.resolve({ id: '1' });
  }

  static Close() {
    return Promise.resolve();
  }

  constructor(options) {
    super();

    this.host_ = options.host;
    this.port_ = options.port;
    this.commandDuration_ = 0;
  }

  setCommandDuration(duration) {
    this.commandDuration_ = duration;
  }

  send(method, params, cb) {
    setTimeout(() => cb(false, {}), this.commandDuration_);

    // reset command duration to 0
    this.setCommandDuration(0);
  }

  close() {
    return Promise.resolve();
  }
}


module.exports = function(options) {
  return Promise.resolve(new Chrome(options));
};

module.exports.List = Chrome.List;
module.exports.New = Chrome.New;
module.exports.Close = Chrome.Close;
