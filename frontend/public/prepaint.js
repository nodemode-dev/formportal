(function () {
  var d = document.documentElement;
  try {
    var mode = localStorage.getItem("formportal-theme");
    var sys = window.matchMedia && window.matchMedia("(prefers-color-scheme: light)").matches;
    if (mode === "light" || (mode !== "dark" && sys)) d.setAttribute("data-theme", "light");
  } catch (e) {
    if (window.matchMedia && window.matchMedia("(prefers-color-scheme: light)").matches) d.setAttribute("data-theme", "light");
  }
})();
