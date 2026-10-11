(function () {
  var d = document.documentElement;
  try {
    if (localStorage.getItem("formportal-theme") === "light") d.setAttribute("data-theme", "light");
  } catch (e) {}
})();
