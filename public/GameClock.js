(function () {
  /**
   * A shared simulation timeline. Browser timers only wake it up; elapsed time
   * determines how many game steps are due, including in a throttled tab.
   */
  function GameClock() {
    this.time = 0;
    this.target = 0;
    this.nextId = 0;
    this.tasks = new Map();
    this.running = false;
    this.processing = false;
    this.wake = this.wake.bind(this);
  }

  GameClock.prototype.start = function () {
    if (this.running) return;
    this.running = true;
    this.lastNow = performance.now();
    this.interval = setInterval(this.wake, 10);
    document.addEventListener('visibilitychange', this.wake);
    // Worker messages help background tabs keep up without relying solely on
    // throttled window timers. The timer remains a fallback (e.g. CSP/file URLs).
    if (typeof Worker === 'function') {
      try {
        const worker = new Worker('GameClockWorker.js');
        this.worker = worker;
        worker.onmessage = this.wake;
        worker.onerror = function () { worker.terminate(); };
      } catch (error) {
        // Elapsed-time catch-up still works when workers are unavailable.
      }
    }
  };

  GameClock.prototype.stop = function () {
    this.running = false;
    clearInterval(this.interval);
    clearTimeout(this.continuation);
    this.continuation = null;
    document.removeEventListener('visibilitychange', this.wake);
    if (this.worker) {
      this.worker.terminate();
      this.worker = null;
    }
    this.target = this.time;
  };

  GameClock.prototype.schedule = function (callback, delay, repeating) {
    delay = Math.max(1, Number(delay) || 1);
    // Nested timers must be relative to the replayed step, not the real clock.
    const base = this.running && !this.processing
      ? this.target + Math.max(0, performance.now() - this.lastNow)
      : this.time;
    const id = ++this.nextId;
    this.tasks.set(id, { id, callback, delay, repeating, due: base + delay });
    return id;
  };

  GameClock.prototype.setInterval = function (callback, delay) {
    return this.schedule(callback, delay, true);
  };

  GameClock.prototype.setTimeout = function (callback, delay) {
    return this.schedule(callback, delay, false);
  };

  GameClock.prototype.clearTimer = function (id) {
    this.tasks.delete(id);
  };

  GameClock.prototype.nextTask = function () {
    let next = null;
    for (const task of this.tasks.values()) {
      if (!next || task.due < next.due) next = task;
    }
    return next;
  };

  GameClock.prototype.wake = function () {
    if (!this.running || this.processing) return;
    clearTimeout(this.continuation);
    this.continuation = null;
    const started = performance.now();
    this.target += Math.max(0, started - this.lastNow);
    this.lastNow = started;
    this.processing = true;
    let steps = 0;
    let next = this.nextTask();

    // Preserve chronological order across production, sales, tournaments and
    // combat. Yield often, retaining the backlog instead of dropping game time.
    while (this.running && next && next.due <= this.target + 1e-7) {
      this.time = next.due;
      if (next.repeating) next.due += next.delay;
      else this.tasks.delete(next.id);
      try {
        next.callback();
      } catch (error) {
        console.error(error);
      }
      next = this.nextTask();
      steps++;
      if (steps >= 1000 || performance.now() - started >= 8) break;
    }
    this.processing = false;

    if (!this.running) return;
    if (next && next.due <= this.target + 1e-7) {
      this.continuation = setTimeout(this.wake, 0);
    } else {
      this.time = this.target;
    }
  };

  window.GameClock = GameClock;
})();
