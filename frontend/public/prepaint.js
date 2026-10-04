(function () {
  var d = document.documentElement;
  try {
    if (localStorage.getItem("formai-theme") === "light") d.setAttribute("data-theme", "light");
  } catch (e) {}
})();
