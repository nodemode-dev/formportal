(function () {
  try {
    var mode = localStorage.getItem("formportal-theme");
    var sys = window.matchMedia && window.matchMedia("(prefers-color-scheme: light)").matches;
    if (mode === "light" || (mode === "system" && sys)) document.documentElement.setAttribute("data-theme", "light");
  } catch (e) {}
})();
