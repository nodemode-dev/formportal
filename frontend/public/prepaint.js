(function () {
  var d = document.documentElement;
  d.setAttribute("data-parsing", "");
  var started = false;
  document.addEventListener("readystatechange", function () {
    if (document.readyState === "loading" || started) return;
    started = true;
    var inter = null;
    if (document.fonts) {
      document.fonts.forEach(function (face) {
        if (face.family.replace(/"/g, "") === "Inter") inter = face;
      });
    }
    var done = false;
    var show = function () {
      if (done) return;
      done = true;
      if (!inter || inter.status !== "loaded") d.setAttribute("data-font", "fallback");
      d.removeAttribute("data-parsing");
    };
    if (!inter || inter.status === "loaded" || inter.status === "error") return show();
    inter.load().then(show, show);
    setTimeout(show, 100);
  });
  try {
    var mode = localStorage.getItem("formportal-theme");
    var sys = window.matchMedia && window.matchMedia("(prefers-color-scheme: light)").matches;
    if (mode === "light" || (mode !== "dark" && sys)) d.setAttribute("data-theme", "light");
  } catch (e) {
    if (window.matchMedia && window.matchMedia("(prefers-color-scheme: light)").matches) d.setAttribute("data-theme", "light");
  }
  try {
    var last = localStorage.getItem("formportal-last");
    var places = ["apps", "updates", "beta", "files", "fonts", "stock", "extensions", "learn", "included"];
    if (localStorage.getItem("formportal-open") === "last" && places.indexOf(last) >= 0 && !/[?&]link=/.test(location.search)) d.setAttribute("data-launch", last);
  } catch (e) {}
})();
