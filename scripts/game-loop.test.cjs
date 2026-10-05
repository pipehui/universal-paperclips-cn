const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const test = require('node:test');

function createGame(workerMode) {
  let now = 0;
  let nextId = 0;
  const timers = new Map();
  const listeners = new Map();
  const elements = new Map();
  const errors = [];
  const workers = [];
  const context = vm.createContext({
    console: { error: error => errors.push(error), log: console.log },
    Audio: function () {},
    Date: { now: () => now },
    performance: { now: () => now },
    setInterval(callback) { timers.set(++nextId, { callback, repeating: true }); return nextId; },
    clearInterval(id) { timers.delete(id); },
    setTimeout(callback) { timers.set(++nextId, { callback, repeating: false }); return nextId; },
    clearTimeout(id) { timers.delete(id); },
    requestAnimationFrame() { return ++nextId; },
    cancelAnimationFrame() {},
    document: {
      hidden: true,
      getElementById(id) {
        if (!elements.has(id)) elements.set(id, {
          style: {}, value: '', innerHTML: '',
          getContext: () => ({ fillRect() {} })
        });
        if (!(id in context)) context[id] = elements.get(id);
        return elements.get(id);
      },
      addEventListener(name, callback) { listeners.set(name, callback); },
      removeEventListener(name) { listeners.delete(name); }
    }
  });
  context.window = context;
  if (workerMode) context.Worker = function () {
    if (workerMode === 'blocked') throw new Error('Worker unavailable');
    this.terminate = () => { this.terminated = true; };
    workers.push(this);
  };
  function load(file) {
    vm.runInContext(fs.readFileSync(path.join(__dirname, '../public', file), 'utf8'), context);
  }
  for (const file of ['GameClock.js', 'Loop.js', 'GameLoop.js']) load(file);
  const game = new context.GameLoop();
  context.Paperclips = { game };
  function fireTimers() {
    for (const [id, timer] of [...timers]) {
      if (!timers.has(id)) continue;
      if (!timer.repeating) timers.delete(id);
      timer.callback();
    }
  }
  return {
    game, context, load, errors, workers,
    advance(milliseconds) {
      now += milliseconds;
      // Background tabs coalesce timer callbacks and do not deliver paint frames.
      fireTimers();
    },
    elapse(milliseconds) { now += milliseconds; },
    show() { context.document.hidden = false; listeners.get('visibilitychange')?.(); },
    drain() {
      for (let attempts = 0; [...timers.values()].some(timer => !timer.repeating); attempts++) {
        assert.ok(attempts < 10000, 'catch-up should finish');
        fireTimers();
      }
    },
    timers
  };
}

test('ten seconds in a hidden tab advances all production and sales ticks', () => {
  const { game, advance } = createGame();
  let productionTicks = 0;
  let salesTicks = 0;
  game.onFast(() => productionTicks++);
  game.onSlow(() => salesTicks++);
  game.start();
  for (let second = 0; second < 10; second++) advance(1000);
  assert.equal(productionTicks, 1000, 'production must follow elapsed time while hidden');
  assert.equal(salesTicks, 100, 'sales must follow elapsed time while hidden');
});

test('foreground and throttled callbacks produce identical ordered game steps', () => {
  function simulate(interval) {
    const { game, advance, drain } = createGame();
    const steps = [];
    game.onFast(() => steps.push('production'));
    game.onSlow(() => steps.push('sale'));
    game.onEvents(() => steps.push('event'));
    game.start();
    for (let time = 0; time < 60000; time += interval) advance(interval);
    drain();
    return steps;
  }
  assert.deepEqual(simulate(60000), simulate(10));
});

test('returning from a suspended tab catches up in bounded batches without losing time', () => {
  const { game, elapse, show, drain } = createGame();
  let ticks = 0;
  game.onFast(() => ticks++);
  game.start();
  elapse(3600000);
  show();
  assert.ok(ticks > 0 && ticks <= 1000, 'first batch must yield');
  drain();
  assert.equal(ticks, 360000);
  show();
  assert.equal(ticks, 360000, 'visibility changes must not count the same time twice');
});

test('start is idempotent and intentional pause does not earn progress', () => {
  const { game, advance, timers } = createGame();
  let ticks = 0;
  game.onFast(() => ticks++);
  game.start();
  game.start();
  advance(100);
  assert.equal(ticks, 10);
  game.stop();
  assert.equal(timers.size, 0);
  advance(60000);
  game.start();
  advance(100);
  assert.equal(ticks, 20);
});

test('nested tournament delays run relative to simulated time during catch-up', () => {
  const { game, advance, drain } = createGame();
  const rounds = [];
  function round() {
    rounds.push(game.clock.time);
    if (rounds.length < 10) game.clock.setTimeout(round, 50);
  }
  game.clock.setTimeout(round, 50);
  game.start();
  advance(1000);
  drain();
  assert.deepEqual(rounds, Array.from({ length: 10 }, (_, index) => (index + 1) * 50));
});

test('custom combat loops, cancellation and speed changes share the timeline', () => {
  const { game, context, advance } = createGame();
  const combat = new context.Loop({ speed: 16 });
  let combatTicks = 0;
  let fastTicks = 0;
  combat.add(() => combatTicks++);
  game.register('combat', combat);
  game.onFast(() => fastTicks++);
  game.start();
  const cancelled = game.clock.setTimeout(() => assert.fail('cancelled timer ran'), 1);
  game.clock.clearTimer(cancelled);
  advance(160);
  assert.equal(combatTicks, 10);
  assert.equal(fastTicks, 16);
  game.fast.setSpeed(20);
  advance(160);
  assert.equal(fastTicks, 24);
  assert.equal(combatTicks, 20);
});

test('actual autoClipper production follows elapsed time without paint frames', () => {
  const { game, context, load, advance, errors } = createGame();
  load('globals.js');
  load('logic.js');
  context.clips = 0;
  context.wire = 10000;
  context.clipmakerLevel = 100;
  game.onFast(context.autoClipper);
  game.start();
  for (let second = 0; second < 10; second++) advance(1000);
  assert.deepEqual(errors, []);
  assert.equal(context.clips, 1000);
  assert.equal(context.wire, 9000);
});

test('investment totals and auto tournaments update without rendering', () => {
  const { game, context, load, advance, drain, errors } = createGame();
  load('globals.js');
  load('logic.js');
  context.stocks = [{ total: 100 }, { total: 200 }];
  context.bankroll = 50;
  context.investStratElement.value = 'low';
  context.resultsFlag = context.autoTourneyFlag = context.autoTourneyStatus = 1;
  context.operations = 1000;
  context.tournamentResultsTableElement.style.display = 'none';
  let starts = 0;
  context.newTourney = () => { starts++; context.resultsFlag = 0; };
  context.runTourney = () => {};
  game.onEvents([context.updateInvestmentValues, context.updateAutoTourney]);
  game.start();
  advance(5000);
  drain();
  assert.deepEqual(errors, []);
  assert.equal(context.secTotal, 300);
  assert.equal(context.portTotal, 350);
  assert.equal(context.riskiness, 7);
  assert.equal(starts, 1);
});

test('worker wakes advance a throttled page without double-counting timer wakes', () => {
  const { game, workers, elapse, advance } = createGame('available');
  let ticks = 0;
  game.onFast(() => ticks++);
  game.start();
  game.start();
  assert.equal(workers.length, 1);
  elapse(1000);
  workers[0].onmessage();
  assert.equal(ticks, 100);
  advance(0);
  assert.equal(ticks, 100);
  game.stop();
  assert.equal(workers[0].terminated, true);
  game.start();
  assert.equal(workers.length, 2);
});

for (const mode of ['blocked', 'available']) {
  test(`window timers still catch up after ${mode === 'blocked' ? 'worker creation is blocked' : 'a worker load error'}`, () => {
    const { game, workers, advance } = createGame(mode);
    let ticks = 0;
    game.onFast(() => ticks++);
    game.start();
    if (mode === 'available') {
      workers[0].onerror();
      assert.equal(workers[0].terminated, true);
    }
    advance(1000);
    assert.equal(ticks, 100);
  });
}

test('an actual tournament completes all delayed rounds during catch-up', () => {
  const { game, context, load, advance, drain, errors } = createGame();
  load('combat.js');
  load('globals.js');
  load('projects.js');
  load('logic.js');
  context.pick = 0;
  context.newTourney();
  game.start();
  context.runTourney();
  advance(1100);
  drain();
  assert.deepEqual(errors, []);
  assert.equal(context.currentRound, 1);
  assert.equal(context.tourneyInProg, 0);
  assert.equal(context.resultsFlag, 1);
});

test('the actual endgame pipeline returns each quantum chip wire exactly once while hidden', () => {
  const { context, load, advance, drain, errors } = createGame();
  for (const file of ['combat.js', 'globals.js', 'projects.js', 'logic.js', 'pipeline-methods.js']) load(file);
  context.localStorage = { getItem: () => null };
  context.ViewManager = function () {};
  context.PluginManager = function () {};
  context.dismantle = 5;
  context.wire = 0;
  context.project213.flag = 1;
  load('main.js');
  // Exercise the registered endgame pipeline without unrelated project UI.
  context.Paperclips.game.fast.stop();
  context.Paperclips.game.slow.stop();
  context.Paperclips.game.custom.combat.stop();
  advance(5000);
  drain();
  assert.deepEqual(errors, []);
  assert.equal(context.wire, 10);
  context.Paperclips.game.render.doRun();
  context.Paperclips.game.render.doRun();
  assert.equal(context.wire, 10, 'repainting must not grant duplicate wire');
  assert.equal(errors.length, 0, [...new Set(errors.map(error => error.message))].join('\n'));
});

test('actual combat advances while its canvas is hidden', () => {
  const { game, context, load, advance, errors } = createGame();
  context.Math = Object.create(Math);
  context.Math.random = () => 0.75;
  for (const file of ['combat.js', 'globals.js', 'logic.js']) load(file);
  context.probeCount = context.drifterCount = 1e9;
  context.createBattle();
  const combat = new context.Loop({ speed: 16 });
  combat.add(context.app.update);
  game.register('combat', combat);
  game.start();
  advance(160);
  assert.deepEqual(errors, []);
  assert.equal(context.masterBattleClock, 10);
});
