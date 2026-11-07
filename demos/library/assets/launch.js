(function () {
  var places = ["fonts", "stock", "learn", "files", "apps"];
  var want = (location.hash || "").replace("#", "");
  var open = places.indexOf(want) >= 0 ? want : "stock";
  document.documentElement.setAttribute("data-launch", open);
})();
