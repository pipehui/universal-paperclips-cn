// A background wake-up source, not the game simulation. The shared clock on
// the page still accounts for elapsed time if these messages are delayed.
setInterval(function () {
  postMessage(null);
}, 50);
