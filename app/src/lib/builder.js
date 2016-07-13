'use strict';

const capabilities = require('selenium-webdriver/lib/capabilities');
const webdriver = require('selenium-webdriver/lib/webdriver');
const http = require('./http');
const chrome = require('./chrome');

const Browser = capabilities.Browser;
const Capabilities = capabilities.Capabilities;
const Capability = capabilities.Capability;
const WebDriver = webdriver.WebDriver;


/**
 * {@linkplain webdriver.WebDriver#setFileDetector WebDriver's setFileDetector}
 * method uses a non-standard command to transfer files from the local client
 * to the remote end hosting the browser. Many of the WebDriver sub-types, like
 * the {@link chrome.Driver} and {@link firefox.Driver}, do not support this
 * command. Thus, these classes override the `setFileDetector` to no-op.
 *
 * This function uses a mixin to re-enable `setFileDetector` by calling the
 * original method on the WebDriver prototype directly. This is used only when
 * the builder creates a Chrome or Firefox instance that communicates with a
 * remote end (and thus, support for remote file detectors is unknown).
 *
 * @param {function(new: webdriver.WebDriver, ...?)} ctor
 * @return {function(new: webdriver.WebDriver, ...?)}
 */
function ensureFileDetectorsAreEnabled(ctor) {
  const mixin = class extends ctor {
    /** @param {input.FileDetector} detector */
    setFileDetector(detector) {
      webdriver.WebDriver.prototype.setFileDetector.call(this, detector);
    }
  };
  return mixin;
}


/**
 * Creates new {@link webdriver.WebDriver WebDriver} instances.
 */
class Builder {
  constructor() {
    /** @private {promise.ControlFlow} */
    this.flow_ = null;

    /** @private {string} */
    this.url_ = '';

    /** @private {!Capabilities} */
    this.capabilities_ = new Capabilities();

    /** @private {chrome.Options} */
    this.chromeOptions_ = null;

    /** @private {firefox.Options} */
    this.firefoxOptions_ = null;

    /** @private {opera.Options} */
    this.operaOptions_ = null;

    /** @private {ie.Options} */
    this.ieOptions_ = null;

    /** @private {safari.Options} */
    this.safariOptions_ = null;

    /** @private {edge.Options} */
    this.edgeOptions_ = null;
  }

  /**
   * Sets the URL of a remote WebDriver server to use. Once a remote URL has
   * been specified, the builder direct all new clients to that server. If this
   * method is never called, the Builder will attempt to create all clients
   * locally.
   *
   * As an alternative to this method, you may also set the
   * `SELENIUM_REMOTE_URL` environment variable.
   *
   * @param {string} url The URL of a remote server to use.
   * @return {!Builder} A self reference.
   */
  usingServer(url) {
    this.url_ = url;
    return this;
  }

  /**
   * @return {string} The URL of the WebDriver server this instance is
   *     configured to use.
   */
  getServerUrl() {
    return this.url_;
  }

  /**
   * Sets the desired capabilities when requesting a new session. This will
   * overwrite any previously set capabilities.
   * @param {!(Object|Capabilities)} capabilities The desired capabilities for
   *     a new session.
   * @return {!Builder} A self reference.
   */
  withCapabilities(capabilities) {
    this.capabilities_ = new Capabilities(capabilities);
    return this;
  }

  /**
   * Returns the base set of capabilities this instance is currently configured
   * to use.
   * @return {!Capabilities} The current capabilities for this builder.
   */
  getCapabilities() {
    return this.capabilities_;
  }

  /**
   * Configures the target browser for clients created by this instance.
   * Any calls to {@link #withCapabilities} after this function will
   * overwrite these settings.
   *
   * You may also define the target browser using the {@code SELENIUM_BROWSER}
   * environment variable. If set, this environment variable should be of the
   * form `browser[:[version][:platform]]`.
   *
   * @param {(string|Browser)} name The name of the target browser;
   *     common defaults are available on the {@link webdriver.Browser} enum.
   * @param {string=} opt_version A desired version; may be omitted if any
   *     version should be used.
   * @param {string=} opt_platform The desired platform; may be omitted if any
   *     version may be used.
   * @return {!Builder} A self reference.
   */
  forBrowser(name, opt_version, opt_platform) {
    this.capabilities_.set(Capability.BROWSER_NAME, name);
    this.capabilities_.set(Capability.VERSION, opt_version || null);
    this.capabilities_.set(Capability.PLATFORM, opt_platform || null);
    return this;
  }

  /**
   * Sets the proxy configuration for the target browser.
   * Any calls to {@link #withCapabilities} after this function will
   * overwrite these settings.
   *
   * @param {!capabilities.ProxyConfig} config The configuration to use.
   * @return {!Builder} A self reference.
   */
  setProxy(config) {
    this.capabilities_.setProxy(config);
    return this;
  }

  /**
   * Sets the logging preferences for the created session. Preferences may be
   * changed by repeated calls, or by calling {@link #withCapabilities}.
   * @param {!(./lib/logging.Preferences|Object<string, string>)} prefs The
   *     desired logging preferences.
   * @return {!Builder} A self reference.
   */
  setLoggingPrefs(prefs) {
    this.capabilities_.setLoggingPrefs(prefs);
    return this;
  }

  /**
   * Sets whether native events should be used.
   * @param {boolean} enabled Whether to enable native events.
   * @return {!Builder} A self reference.
   */
  setEnableNativeEvents(enabled) {
    this.capabilities_.setEnableNativeEvents(enabled);
    return this;
  }

  /**
   * Sets how elements should be scrolled into view for interaction.
   * @param {number} behavior The desired scroll behavior: either 0 to align
   *     with the top of the viewport or 1 to align with the bottom.
   * @return {!Builder} A self reference.
   */
  setScrollBehavior(behavior) {
    this.capabilities_.setScrollBehavior(behavior);
    return this;
  }

  /**
   * Sets the default action to take with an unexpected alert before returning
   * an error.
   * @param {string} behavior The desired behavior; should be "accept",
   *     "dismiss", or "ignore". Defaults to "dismiss".
   * @return {!Builder} A self reference.
   */
  setAlertBehavior(behavior) {
    this.capabilities_.setAlertBehavior(behavior);
    return this;
  }

  /**
   * Sets Chrome specific {@linkplain chrome.Options options} for drivers
   * created by this builder. Any logging or proxy settings defined on the given
   * options will take precedence over those set through
   * {@link #setLoggingPrefs} and {@link #setProxy}, respectively.
   *
   * @param {!chrome.Options} options The ChromeDriver options to use.
   * @return {!Builder} A self reference.
   */
  setChromeOptions(options) {
    this.chromeOptions_ = options;
    return this;
  }

  /**
   * Sets Firefox specific {@linkplain firefox.Options options} for drivers
   * created by this builder. Any logging or proxy settings defined on the given
   * options will take precedence over those set through
   * {@link #setLoggingPrefs} and {@link #setProxy}, respectively.
   *
   * @param {!firefox.Options} options The FirefoxDriver options to use.
   * @return {!Builder} A self reference.
   */
  setFirefoxOptions(options) {
    this.firefoxOptions_ = options;
    return this;
  }

  /**
   * Sets Opera specific {@linkplain opera.Options options} for drivers created
   * by this builder. Any logging or proxy settings defined on the given options
   * will take precedence over those set through {@link #setLoggingPrefs} and
   * {@link #setProxy}, respectively.
   *
   * @param {!opera.Options} options The OperaDriver options to use.
   * @return {!Builder} A self reference.
   */
  setOperaOptions(options) {
    this.operaOptions_ = options;
    return this;
  }

  /**
   * Set Internet Explorer specific {@linkplain ie.Options options} for drivers
   * created by this builder. Any proxy settings defined on the given options
   * will take precedence over those set through {@link #setProxy}.
   *
   * @param {!ie.Options} options The IEDriver options to use.
   * @return {!Builder} A self reference.
   */
  setIeOptions(options) {
    this.ieOptions_ = options;
    return this;
  }

  /**
   * Set {@linkplain edge.Options options} specific to Microsoft's Edge browser
   * for drivers created by this builder. Any proxy settings defined on the
   * given options will take precedence over those set through
   * {@link #setProxy}.
   *
   * @param {!edge.Options} options The MicrosoftEdgeDriver options to use.
   * @return {!Builder} A self reference.
   */
  setEdgeOptions(options) {
    this.edgeOptions_ = options;
    return this;
  }

  /**
   * Sets Safari specific {@linkplain safari.Options options} for drivers
   * created by this builder. Any logging settings defined on the given options
   * will take precedence over those set through {@link #setLoggingPrefs}.
   *
   * @param {!safari.Options} options The Safari options to use.
   * @return {!Builder} A self reference.
   */
  setSafariOptions(options) {
    this.safariOptions_ = options;
    return this;
  }

  /**
   * Sets the control flow that created drivers should execute actions in. If
   * the flow is never set, or is set to {@code null}, it will use the active
   * flow at the time {@link #build()} is called.
   * @param {promise.ControlFlow} flow The control flow to use, or
   *     {@code null} to
   * @return {!Builder} A self reference.
   */
  setControlFlow(flow) {
    this.flow_ = flow;
    return this;
  }

  /**
   * Creates a new WebDriver client based on this builder's current
   * configuration.
   *
   * While this method will immediately return a new WebDriver instance, any
   * commands issued against it will be deferred until the associated browser
   * has been fully initialized. Users may call {@link #buildAsync()} to obtain
   * a promise that will not be fulfilled until the browser has been created
   * (the difference is purely in style).
   *
   * @return {!webdriver.WebDriver} A new WebDriver instance.
   * @throws {Error} If the current configuration is invalid.
   * @see #buildAsync()
   */
  build() {
    // Create a copy for any changes we may need to make based on the current
    // environment.
    let capabilities = new Capabilities(this.capabilities_),
      browser = capabilities.get(Capability.BROWSER_NAME);

    if (typeof browser !== 'string') {
      throw TypeError(
          `Target browser must be a string, but is <${typeof browser}>
          ; did you forget to call forBrowser()?`);
    }

    if (browser === 'ie') {
      browser = Browser.INTERNET_EXPLORER;
    }

    // Apply browser specific overrides.
    if (browser === Browser.CHROME && this.chromeOptions_) {
      capabilities.merge(this.chromeOptions_.toCapabilities());

    } else if (browser === Browser.FIREFOX && this.firefoxOptions_) {
      capabilities.merge(this.firefoxOptions_.toCapabilities());

    } else if (browser === Browser.INTERNET_EXPLORER && this.ieOptions_) {
      capabilities.merge(this.ieOptions_.toCapabilities());

    } else if (browser === Browser.OPERA && this.operaOptions_) {
      capabilities.merge(this.operaOptions_.toCapabilities());

    } else if (browser === Browser.SAFARI && this.safariOptions_) {
      capabilities.merge(this.safariOptions_.toCapabilities());

    } else if (browser === Browser.EDGE && this.edgeOptions_) {
      capabilities.merge(this.edgeOptions_.toCapabilities());
    }

    // Check for a remote browser.
    if (this.url_) {
      let client = Promise.resolve(this.url_)
        .then(url => new http.Client(url));
      let executor = new http.Executor(client);

      if (browser === Browser.CHROME) {
        const driver = ensureFileDetectorsAreEnabled(chrome.Driver);
        return new driver(capabilities, executor, this.flow_);
      }

      if (browser === Browser.FIREFOX) {
        const driver = ensureFileDetectorsAreEnabled(firefox.Driver);
        return new driver(capabilities, executor, this.flow_);
      }

      return WebDriver.createSession(executor, capabilities, this.flow_);
    }

    // TODO: Use extension executor
    if (browser === Browser.CHROME) {
      throw new Error('Extension executor not implemented.');
    } else {
      throw new Error(
        `Do not know how to build driver: ${browser}
        ; did you forget to call usingServer(url)?`);
    }
  }

  /**
   * Creates a new WebDriver client based on this builder's current
   * configuration. This method returns a promise that will not be fulfilled
   * until the new browser session has been fully initialized.
   *
   * __Note:__ this method is purely a convenience wrapper around
   * {@link #build()}.
   *
   * @return {!promise.Promise<!webdriver.WebDriver>} A promise that will be
   *    fulfilled with the newly created WebDriver instance once the browser
   *    has been fully initialized.
   * @see #build()
   */
  buildAsync() {
    let driver = this.build();
    return driver.getSession().then(() => driver);
  }
}


exports.Builder = Builder;
