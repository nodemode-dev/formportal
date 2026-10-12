(function () {
  var d = document.documentElement;
  d.setAttribute("data-parsing", "");
  document.addEventListener("readystatechange", function () {
    if (document.readyState !== "loading") d.removeAttribute("data-parsing");
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
    var places = ["apps", "updates", "beta", "files", "fonts", "stock", "extensions", "learn"];
    if (localStorage.getItem("formportal-open") === "last" && places.indexOf(last) >= 0 && !/[?&]link=/.test(location.search)) d.setAttribute("data-launch", last);
  } catch (e) {}
})();
