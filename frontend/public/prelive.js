(function () {
  try {
    var kept = JSON.parse(localStorage.getItem("formportal.live") || "null");
    if (!kept || typeof kept.live !== "string" || !Array.isArray(kept.soon)) return;
    var d = document.documentElement;
    d.setAttribute("data-live", kept.live);
    var left = 0;
    for (var i = 0; i < kept.soon.length; i++) {
      var n = Number(kept.soon[i]);
      if (!(n >= 0) || !d.hasAttribute("data-soon-g" + i)) continue;
      d.setAttribute("data-soon-g" + i, String(n));
      left += n;
    }
    d.setAttribute("data-soon-left", String(left));
    var more = Number(kept.more);
    if (more >= 0 && d.hasAttribute("data-soon-more")) d.setAttribute("data-soon-more", String(Math.min(40, Math.floor(more))));
  } catch (e) {}
})();
