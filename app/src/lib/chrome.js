/**
 * @fileoverview Defines configuration options for each new Chrome
 *     session, such as which {@linkplain Options#setProxy proxy} to use,
 *     what {@linkplain Options#addExtensions extensions} to install, or
 *     what {@linkplain Options#addArguments command-line switches} to use when
 *     starting the browser.
 *
 * __Starting the [ChromeDriver] Server__ <a id="custom-server"></a>
 *
 * You will need to start the ChromeDriver server manually if you wish to use the
 * {@link http.HttpExecutor}.
 *
 * __Working with Android__ <a id="android"></a>
 *
 * The [ChromeDriver][android] supports running tests on the Chrome browser as
 * well as [WebView apps][webview] starting in Android 4.4 (KitKat). In order to
 * work with Android, you must first start the adb
 *
 *     adb start-server
 *
 * By default, adb will start on port 5037. You may change this port but this will
 * require setting it through `--adb-port=` argument when starting ChromeDriver.
 *
 * The ChromeDriver may be configured to launch Chrome on Android using
 * {@link Options#androidChrome()}:
 *
 *     let driver = new Builder()
 *         .forBrowser('chrome')
 *         .setChromeOptions(new chrome.Options().androidChrome())
 *         .build();
 *
 * Alternatively, you can configure the ChromeDriver to launch an app with a
 * Chrome-WebView by setting the {@linkplain Options#androidActivity
 * androidActivity} option:
 *
 *     let driver = new Builder()
 *         .forBrowser('chrome')
 *         .setChromeOptions(new chrome.Options()
 *             .androidPackage('com.example')
 *             .androidActivity('com.example.Activity'))
 *         .build();
 *
 * [Refer to the ChromeDriver site][ChromeDriver] for more information on using
 * [ChromeDriver with Android][android].
 *
 * [ChromeDriver]: https://sites.google.com/a/chromium.org/chromedriver/
 * [ChromeDriver release]: http://chromedriver.storage.googleapis.com/index.html
 * [android]: https://sites.google.com/a/chromium.org/chromedriver/getting-started/getting-started---android
 * [webview]: https://developer.chrome.com/multidevice/webview/overview
 */

'use strict';

const capabilities = require('selenium-webdriver/lib/capabilities'),
  Capabilities = capabilities.Capabilities,
  Capability = capabilities.Capability,
  Symbols = require('selenium-webdriver/lib/symbols'),
  command = require('selenium-webdriver/lib/command'),
  webdriver = require('selenium-webdriver/lib/webdriver'),
  http = require('./http');


/**
 * @type {string}
 * @const
 */
let OPTIONS_CAPABILITY_KEY = 'chromeOptions';


/**
 * Class for managing ChromeDriver specific options.
 */
class Options {
  constructor() {
    /** @private {!Object} */
    this.options_ = {};

    /** @private {!Array<(string|!Buffer)>} */
    this.extensions_ = [];

    /** @private {?logging.Preferences} */
    this.logPrefs_ = null;

    /** @private {?./lib/capabilities.ProxyConfig} */
    this.proxy_ = null;
  }

  /**
   * Extracts the ChromeDriver specific options from the given capabilities
   * object.
   * @param {!Capabilities} caps The capabilities object.
   * @return {!Options} The ChromeDriver options.
   */
  static fromCapabilities(caps) {
    let options = new Options();

    let o = caps.get(OPTIONS_CAPABILITY_KEY);
    if (o instanceof Options) {
      options = o;
    } else if (o) {
      options.
          addArguments(o.args || []).
          addExtensions(o.extensions || []).
          detachDriver(o.detach).
          excludeSwitches(o.excludeSwitches || []).
          setChromeBinaryPath(o.binary).
          setChromeLogFile(o.logPath).
          setChromeMinidumpPath(o.minidumpPath).
          setLocalState(o.localState).
          setMobileEmulation(o.mobileEmulation).
          setUserPreferences(o.prefs).
          setPerfLoggingPrefs(o.perfLoggingPrefs);
    }

    if (caps.has(Capability.PROXY)) {
      options.setProxy(caps.get(Capability.PROXY));
    }

    if (caps.has(Capability.LOGGING_PREFS)) {
      options.setLoggingPrefs(
          caps.get(Capability.LOGGING_PREFS));
    }

    return options;
  }

  /**
   * Add additional command line arguments to use when launching the Chrome
   * browser.  Each argument may be specified with or without the "--" prefix
   * (e.g. "--foo" and "foo"). Arguments with an associated value should be
   * delimited by an "=": "foo=bar".
   * @param {...(string|!Array<string>)} var_args The arguments to add.
   * @return {!Options} A self reference.
   */
  addArguments(var_args) {
    let args = this.options_.args || [];
    args = args.concat.apply(args, arguments);
    if (args.length) {
      this.options_.args = args;
    }
    return this;
  }

  /**
   * List of Chrome command line switches to exclude that ChromeDriver by default
   * passes when starting Chrome.  Do not prefix switches with "--".
   *
   * @param {...(string|!Array<string>)} var_args The switches to exclude.
   * @return {!Options} A self reference.
   */
  excludeSwitches(var_args) {
    let switches = this.options_.excludeSwitches || [];
    switches = switches.concat.apply(switches, arguments);
    if (switches.length) {
      this.options_.excludeSwitches = switches;
    }
    return this;
  }

  /**
   * Add additional extensions to install when launching Chrome. Each extension
   * should be specified as the path to the packed CRX file, or a Buffer for an
   * extension.
   * @param {...(string|!Buffer|!Array<(string|!Buffer)>)} var_args The
   *     extensions to add.
   * @return {!Options} A self reference.
   */
  addExtensions(var_args) {
    this.extensions_ =
        this.extensions_.concat.apply(this.extensions_, arguments);
    return this;
  }

  /**
   * Sets the path to the Chrome binary to use. On Mac OS X, this path should
   * reference the actual Chrome executable, not just the application binary
   * (e.g. "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome").
   *
   * The binary path be absolute or relative to the chromedriver server
   * executable, but it must exist on the machine that will launch Chrome.
   *
   * @param {string} path The path to the Chrome binary to use.
   * @return {!Options} A self reference.
   */
  setChromeBinaryPath(path) {
    this.options_.binary = path;
    return this;
  }

  /**
   * Sets whether to leave the started Chrome browser running if the controlling
   * ChromeDriver service is killed before {@link webdriver.WebDriver#quit()} is
   * called.
   * @param {boolean} detach Whether to leave the browser running if the
   *     chromedriver service is killed before the session.
   * @return {!Options} A self reference.
   */
  detachDriver(detach) {
    this.options_.detach = detach;
    return this;
  }

  /**
   * Sets the user preferences for Chrome's user profile. See the "Preferences"
   * file in Chrome's user data directory for examples.
   * @param {!Object} prefs Dictionary of user preferences to use.
   * @return {!Options} A self reference.
   */
  setUserPreferences(prefs) {
    this.options_.prefs = prefs;
    return this;
  }

  /**
   * Sets the logging preferences for the new session.
   * @param {!logging.Preferences} prefs The logging preferences.
   * @return {!Options} A self reference.
   */
  setLoggingPrefs(prefs) {
    this.logPrefs_ = prefs;
    return this;
  }

  /**
   * Sets the performance logging preferences. Options include:
   *
   * - `enableNetwork`: Whether or not to collect events from Network domain.
   * - `enablePage`: Whether or not to collect events from Page domain.
   * - `enableTimeline`: Whether or not to collect events from Timeline domain.
   *     Note: when tracing is enabled, Timeline domain is implicitly disabled,
   *     unless `enableTimeline` is explicitly set to true.
   * - `tracingCategories`: A comma-separated string of Chrome tracing
   *     categories for which trace events should be collected. An unspecified
   *     or empty string disables tracing.
   * - `bufferUsageReportingInterval`: The requested number of milliseconds
   *     between DevTools trace buffer usage events. For example, if 1000, then
   *     once per second, DevTools will report how full the trace buffer is. If
   *     a report indicates the buffer usage is 100%, a warning will be issued.
   *
   * @param {{enableNetwork: boolean,
   *          enablePage: boolean,
   *          enableTimeline: boolean,
   *          tracingCategories: string,
   *          bufferUsageReportingInterval: number}} prefs The performance
   *     logging preferences.
   * @return {!Options} A self reference.
   */
  setPerfLoggingPrefs(prefs) {
    this.options_.perfLoggingPrefs = prefs;
    return this;
  }

  /**
   * Sets preferences for the "Local State" file in Chrome's user data
   * directory.
   * @param {!Object} state Dictionary of local state preferences.
   * @return {!Options} A self reference.
   */
  setLocalState(state) {
    this.options_.localState = state;
    return this;
  }

  /**
   * Sets the name of the activity hosting a Chrome-based Android WebView. This
   * option must be set to connect to an [Android WebView](
   * https://sites.google.com/a/chromium.org/chromedriver/getting-started/getting-started---android)
   *
   * @param {string} name The activity name.
   * @return {!Options} A self reference.
   */
  androidActivity(name) {
    this.options_.androidActivity = name;
    return this;
  }

  /**
   * Sets the device serial number to connect to via ADB. If not specified, the
   * ChromeDriver will select an unused device at random. An error will be
   * returned if all devices already have active sessions.
   *
   * @param {string} serial The device serial number to connect to.
   * @return {!Options} A self reference.
   */
  androidDeviceSerial(serial) {
    this.options_.androidDeviceSerial = serial;
    return this;
  }

  /**
   * Configures the ChromeDriver to launch Chrome on Android via adb. This
   * function is shorthand for
   * {@link #androidPackage options.androidPackage('com.android.chrome')}.
   * @return {!Options} A self reference.
   */
  androidChrome() {
    return this.androidPackage('com.android.chrome');
  }

  /**
   * Sets the package name of the Chrome or WebView app.
   *
   * @param {?string} pkg The package to connect to, or `null` to disable Android
   *     and switch back to using desktop Chrome.
   * @return {!Options} A self reference.
   */
  androidPackage(pkg) {
    this.options_.androidPackage = pkg;
    return this;
  }

  /**
   * Sets the process name of the Activity hosting the WebView (as given by
   * `ps`). If not specified, the process name is assumed to be the same as
   * {@link #androidPackage}.
   *
   * @param {string} processName The main activity name.
   * @return {!Options} A self reference.
   */
  androidProcess(processName) {
    this.options_.androidProcess = processName;
    return this;
  }

  /**
   * Sets whether to connect to an already-running instead of the specified
   * {@linkplain #androidProcess app} instead of launching the app with a clean
   * data directory.
   *
   * @param {boolean} useRunning Whether to connect to a running instance.
   * @return {!Options} A self reference.
   */
  androidUseRunningApp(useRunning) {
    this.options_.androidUseRunningApp = useRunning;
    return this;
  }

  /**
   * Sets the path to Chrome's log file. This path should exist on the machine
   * that will launch Chrome.
   * @param {string} path Path to the log file to use.
   * @return {!Options} A self reference.
   */
  setChromeLogFile(path) {
    this.options_.logPath = path;
    return this;
  }

  /**
   * Sets the directory to store Chrome minidumps in. This option is only
   * supported when ChromeDriver is running on Linux.
   * @param {string} path The directory path.
   * @return {!Options} A self reference.
   */
  setChromeMinidumpPath(path) {
    this.options_.minidumpPath = path;
    return this;
  }

  /**
   * Configures Chrome to emulate a mobile device. For more information, refer
   * to the ChromeDriver project page on [mobile emulation][em]. Configuration
   * options include:
   *
   * - `deviceName`: The name of a pre-configured [emulated device][devem]
   * - `width`: screen width, in pixels
   * - `height`: screen height, in pixels
   * - `pixelRatio`: screen pixel ratio
   *
   * __Example 1: Using a Pre-configured Device__
   *
   *     let options = new chrome.Options().setMobileEmulation(
   *         {deviceName: 'Google Nexus 5'});
   *
   *     let driver = new chrome.Driver(options);
   *
   * __Example 2: Using Custom Screen Configuration__
   *
   *     let options = new chrome.Options().setMobileEmulation({
   *         width: 360,
   *         height: 640,
   *         pixelRatio: 3.0
   *     });
   *
   *     let driver = new chrome.Driver(options);
   *
   *
   * [em]: https://sites.google.com/a/chromium.org/chromedriver/mobile-emulation
   * [devem]: https://developer.chrome.com/devtools/docs/device-mode
   *
   * @param {?({deviceName: string}|
   *           {width: number, height: number, pixelRatio: number})} config The
   *     mobile emulation configuration, or `null` to disable emulation.
   * @return {!Options} A self reference.
   */
  setMobileEmulation(config) {
    this.options_.mobileEmulation = config;
    return this;
  }

  /**
   * Sets the proxy settings for the new session.
   * @param {./lib/capabilities.ProxyConfig} proxy The proxy configuration to
   *    use.
   * @return {!Options} A self reference.
   */
  setProxy(proxy) {
    this.proxy_ = proxy;
    return this;
  }

  /**
   * Converts this options instance to a {@link Capabilities} object.
   * @param {Capabilities=} opt_capabilities The capabilities to merge
   *     these options into, if any.
   * @return {!Capabilities} The capabilities.
   */
  toCapabilities(opt_capabilities) {
    let caps = opt_capabilities || Capabilities.chrome();
    caps.
        set(Capability.PROXY, this.proxy_).
        set(Capability.LOGGING_PREFS, this.logPrefs_).
        set(OPTIONS_CAPABILITY_KEY, this);
    return caps;
  }

  /**
   * Converts this instance to its JSON wire protocol representation. Note this
   * function is an implementation not intended for general use.
   * @return {!Object} The JSON wire protocol representation of this instance.
   */
  [Symbols.serialize]() {
    let json = {};
    for (let key in this.options_) {
      if (this.options_[key] != null) {
        json[key] = this.options_[key];
      }
    }
    if (this.extensions_.length) {
      json.extensions = this.extensions_.map(function(extension) {
        if (Buffer.isBuffer(extension)) {
          return extension.toString('base64');
        }
        // Reading extension files by path is not supported by this implementation.
        console.warn(`Cannot install extension from path ${extension}.`);
      });
    }
    return json;
  }
}


/**
 * Custom command names supported by ChromeDriver.
 * @enum {string}
 */
const Command = {
  LAUNCH_APP: 'launchApp'
};


/**
 * Configures the given executor with Chrome-specific commands.
 * @param {!http.Executor} executor the executor to configure.
 */
function configureExecutor(executor) {
  executor.defineCommand(
      Command.LAUNCH_APP,
      'POST',
      '/session/:sessionId/chromium/launch_app');
}


/**
 * Creates a new WebDriver client for Chrome.
 */
class Driver extends webdriver.WebDriver {
  /**
   * @param {(Capabilities|Options)=} opt_config The configuration
   *     options.
   * @param {http.Executor} executor A pre-configured command executor that
   *     should be used to send commands to the remote end. The provided
   *     executor should not be reused with other clients as its internal
   *     command mappings will be updated to support Chrome-specific commands.
   * @param {promise.ControlFlow=} opt_flow The control flow to use,
   *     or {@code null} to use the currently active flow.
   */
  constructor(opt_config, executor, opt_flow) {
    try {
      configureExecutor(executor);
    } catch(e) {
      throw Error('Invalid executor.');
    }

    let caps =
        opt_config instanceof Options ? opt_config.toCapabilities() :
        (opt_config || Capabilities.chrome());

    let driver = webdriver.WebDriver.createSession(executor, caps, opt_flow);

    super(driver.getSession(), executor, driver.controlFlow());
  }

  /**
   * This function is a no-op as file detectors are not supported by this
   * implementation.
   * @override
   */
  setFileDetector() {}

  /**
   * Schedules a command to launch Chrome App with given ID.
   * @param {string} id ID of the App to launch.
   * @return {!promise.Promise<void>} A promise that will be resolved
   *     when app is launched.
   */
  launchApp(id) {
    return this.schedule(
        new command.Command(Command.LAUNCH_APP).setParameter('id', id),
        'Driver.launchApp()');
  }
}


// PUBLIC API


exports.Driver = Driver;
exports.Options = Options;
