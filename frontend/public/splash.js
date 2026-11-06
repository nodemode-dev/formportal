window.formportalSplashDone = function () {
  var fill = document.querySelector('.fill');
  fill.style.transform = getComputedStyle(fill).transform;
  fill.classList.add('done');
  requestAnimationFrame(function () { fill.style.transform = ''; });
};
