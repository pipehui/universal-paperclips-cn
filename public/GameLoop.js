(function () {

  /**
   * @class GameLoop
   * This class encapsulates the game loop logic.
   */
  function GameLoop () {
    this.clock = new GameClock();
    this.render = new RenderLoop();
    this.slow = new Loop({ speed: 100, clock: this.clock });
    this.fast = new Loop({ speed: 10, clock: this.clock });
    // Legacy game events used to run on paint frames. Give them a fixed 60 Hz
    // rate so hiding the page (or a high-refresh display) cannot change progress.
    this.events = new Loop({ speed: 1000 / 60, clock: this.clock });
    this.custom = {};
  }

  /**
   * Adds a custom loop to be managed by the game loop manager.
   * @param {String} name The name of the custom loop
   * @param {Loop} loop The loop to be added
   */
  GameLoop.prototype.register = function register(name, loop) {
    loop.config.clock = this.clock;
    this.custom[name] = loop;
  }

  /**
   * Starts running the game loops at the configured speeds.
   */
  GameLoop.prototype.start = function start() {
    this.slow.start();
    this.fast.start();
    this.events.start();
    this.render.start();

    this.eachCustom( loop => loop.start() );
    this.clock.start();
  };

  /**
   * Stops all of the game loops, effectively pausing the game.
   */
  GameLoop.prototype.stop = function stop() {
    this.slow.stop();
    this.fast.stop();
    this.events.stop();
    this.render.stop();

    this.eachCustom( loop => loop.stop() );
    this.clock.stop();
  };

  /**
   * Registers a collection of callbacks to be invoked on each iteration of the
   * slow loop.
   * @param {Function[]} callbacks An array of callbacks to invoke on the slow loop
   */
  GameLoop.prototype.onSlow = function onSlow(callbacks) {
    this.slow.add(callbacks);
  };

  /**
   * Registers a collection of callbacks to be invoked on each iteration of the
   * fast loop.
   * @param {Function[]} callbacks An array of callbacks to invoke on the fast loop
   */
  GameLoop.prototype.onFast = function onFast(callbacks) {
    this.fast.add(callbacks);
  };

  /**
   * Registers a collection of callbacks to be invoked on each iteration of the
   * render loop.
   * @param {Function[]} callbacks An array of callbacks to invoke on the render loop
   */
  GameLoop.prototype.onRender = function onRender(callbacks) {
    this.render.add(callbacks);
  };

  GameLoop.prototype.onEvents = function onEvents(callbacks) {
    this.events.add(callbacks);
  };

  /**
   * Iterates over all of the registered custom loops invoking the provided
   * function.
   * @param {Function} callback The function invoked for each custom loop
   */
  GameLoop.prototype.eachCustom = function eachCustom(callback) {
    const results = [];

    for (let name in this.custom) {
      results.push(callback(this.custom[name], name));
    }

    return results;
  };

  window.GameLoop = GameLoop;
})();
