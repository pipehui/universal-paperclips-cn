# Universal Paperclips
## General
This page contains general information about the way Paperclips works.

### Game Loop
The game uses a shared elapsed-time scheduler in [GameClock.js](../public/GameClock.js). The main logic runs in 10ms simulation steps, while sales, wire prices and autosaving use 100ms steps. Browser timer callbacks wake the scheduler; their frequency does not determine the amount of game progress.

[GameClockWorker.js](../public/GameClockWorker.js) sends a wake-up message every 50ms to help keep background pages running. A 10ms window timer remains available if workers cannot load, and `visibilitychange` also wakes the clock. Delayed callbacks are replayed in chronological order across all loops. Each catch-up batch yields after 1000 callbacks or approximately 8ms of work, retaining unfinished steps for the next batch. The clock uses monotonic `performance.now()` so changing the system clock does not grant extra production.

Investment totals, auto-tournament startup and endgame events run at a fixed 60Hz through `onEvents()`, independently of painting. Combat uses a registered 16ms loop, and tournament round delays use `game.clock.setTimeout()`. Nested delays are relative to the simulated step, allowing an entire tournament to catch up correctly. Rendering remains on `requestAnimationFrame()`; hidden battle canvases skip drawing while combat continues.

This supports an open page. A fully frozen page must resume before any script can run; closing, reloading or discarding the page does not grant offline progress. Save fields are unchanged. An explicit `game.stop()` stops its wake-up sources, so intentionally paused time is not counted.

Run `npm test` for localization/syntax checks and deterministic regression tests covering throttled timers, ordered catch-up, a one-hour suspension, worker fallback, pause/resume, real production and tournament logic, and endgame wire rewards.

The game seems to consume a fair amount of battery power while running both in the web and on Android, this is likely due to the fact that the bulk of the games work is done in the fast loop. Some things could be moved out of the fast loop and into the slow loop without compromising speed of progress in the game. The project management subsystem is one such component which has already been moved to the slow loop due its DOM manipulation making it costly to repeatedly call.

The main loop also updates the DOM with all of the current values. This is a lot of elements whose `innerHTML` is being changed. We could get a decent performance improvement if the DOM manipulation was done in animation frames.

#### Other Loops
There are also a small collection of other more specific game loops. Below is a list of other loops and what they do;

- Stock List Display Loop (runs every 100ms)
- Stock Purchasing Loop (runs every 1000ms)
- Stock Selling Loop (runs every 2500ms)
- Strategy Picker Loop (runs every 100ms)

~~These could be consolidated into two game loops the slow and fast ones. The strategy picker loop could be changed to an event listener instead of polling the element for change.~~ **EDIT: The game loop has been refactored to make use of the GameLoop class which provides a slow loop, fast loop and a render loop. All tasks within the various game loops have been refactored into one of these pipelines**

### The New Game Loop
The `GameLoop` class manages the fast (10ms), slow (100ms), event (60Hz) and render loops. Use `onFast()`, `onSlow()`, `onEvents()` and `onRender()` to add callbacks. `register(name, loop)` attaches a custom `Loop` to the same simulation clock. The render loop runs before browser painting; game state changes must use one of the simulation loops so progress does not depend on page visibility or display refresh rate.

The game already had a fast and slow loop (among others) but it did not have a render loop. The render loop is special as it uses `requestAnimationFrame()` to hook into the browsers rendering system. This loop will be invoked just before the browser is about to repaint and reflow the window. Putting tasks which affect the DOM here should help prevent the browser from being forced to reflow between frames. This loop will typically be called at the display devices natural refresh rate, typically at a rate of 60Hz.  This loop is not invoked when the browser or tab does not have focus or isn't visible on the screen, this should also help improve battery life on devices playing the game.

This class orchestrates game tasks and keeps display work in the render loop where possible. There are various methods within [pipeline-methods.js](../public/pipeline-methods.js) which help you ensure the callback is only called on the loop when certain criteria are met. Below is an example game loop using this class;

```javascript
var game = new GameLoop();

game.onFast([
  calculateClipCount,
  withHumans(chain([
    calculateClipSales,
    manageStocksAndShares
  ]))
]);

game.start();
```

The example above sets up a new game loop and adds callbacks to the fast game loop to be called every 10ms. The `onX()` methods take an array of functions as arguments. In the example the `calculateClipCount` function will get called every 10ms, however the functions `calculateClipSales` and `manageStocksAndShares` will ONLY get called every 10ms if there are still humans. The `withHumans()` function takes a function and returns a new function which when called will only call the given function if `humanFlag == 0`. The `chain()` function works much the same only it takes an array of functions and when it's called it will call each function in the array.

The new game loop lives in [main.js](../public/main.js) and everything else has been moved out into [logic.js](../public/logic.js).
