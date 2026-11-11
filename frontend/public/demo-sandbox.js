(function () {
  var real = window.localStorage;
  var PREFIX = "formportal-demo:";
  var READ = ["formportal-theme", "nodemode_ui_settings"];
  var own = function () {
    var out = [];
    for (var i = 0; i < real.length; i++) {
      var k = real.key(i);
      if (k && k.indexOf(PREFIX) === 0) out.push(k.slice(PREFIX.length));
    }
    return out;
  };
  var store = {
    getItem: function (k) {
      k = String(k);
      var v = real.getItem(PREFIX + k);
      if (v === null && READ.indexOf(k) >= 0) v = real.getItem(k);
      return v;
    },
    setItem: function (k, v) {
      real.setItem(PREFIX + String(k), String(v));
    },
    removeItem: function (k) {
      real.removeItem(PREFIX + String(k));
    },
    clear: function () {
      own().forEach(function (k) {
        real.removeItem(PREFIX + k);
      });
    },
    key: function (i) {
      var k = own()[i];
      return k === undefined ? null : k;
    },
    get length() {
      return own().length;
    },
  };
  try {
    Object.defineProperty(window, "localStorage", { configurable: true, get: function () { return store; } });
  } catch (e) {}
  ["__TAURI__", "__TAURI_INTERNALS__", "__TAURI_IPC__"].forEach(function (name) {
    try {
      delete window[name];
    } catch (e) {}
  });
  document.documentElement.setAttribute("data-demo-frame", "");
})();
