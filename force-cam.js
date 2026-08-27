(function () {
  function apply() {
    const v = document.getElementById("video-output");
    if (!v) return;
    if (v.parentElement !== document.body) document.body.insertBefore(v, document.body.firstChild);
    v.style.setProperty("position", "fixed", "important");
    v.style.setProperty("left", "50%", "important");
    v.style.setProperty("top", "50%", "important");
    v.style.setProperty("right", "auto", "important");
    v.style.setProperty("bottom", "auto", "important");
    v.style.setProperty("width", "100vh", "important");
    v.style.setProperty("height", "100vw", "important");
    v.style.setProperty("max-width", "none", "important");
    v.style.setProperty("max-height", "none", "important");
    v.style.setProperty("object-fit", "contain", "important");
    v.style.setProperty("object-position", "center center", "important");
    v.style.setProperty("transform-origin", "center center", "important");
    v.style.setProperty("transform", "translate(-50%, -50%) rotate(-90deg)", "important");
    v.style.setProperty("background", "transparent", "important");
    v.style.setProperty("z-index", "0", "important");
  }
  apply();
  setInterval(apply, 300);
})();
