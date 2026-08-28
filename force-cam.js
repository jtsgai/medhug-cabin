(function () {
  const old = document.getElementById("video-key");
  if (old) old.remove();
  function hide(v) {
    v.style.setProperty("opacity", "0", "important");
    v.style.setProperty("visibility", "hidden", "important");
  }
  function fillLocal(v) {
    const s = v.style;
    s.setProperty("position", "fixed", "important");
    s.setProperty("inset", "0", "important");
    s.setProperty("left", "0", "important");
    s.setProperty("top", "0", "important");
    s.setProperty("width", "100vw", "important");
    s.setProperty("height", "100vh", "important");
    s.setProperty("max-width", "none", "important");
    s.setProperty("max-height", "none", "important");
    s.setProperty("object-fit", "cover", "important");
    s.setProperty("object-position", "center center", "important");
    s.setProperty("background", "#000", "important");
    s.setProperty("opacity", "1", "important");
    s.setProperty("visibility", "visible", "important");
    s.setProperty("pointer-events", "none", "important");
    s.setProperty("transform", "none", "important");
    s.setProperty("mix-blend-mode", "normal", "important");
    s.setProperty("z-index", "0", "important");
  }
  function fitDecart(v) {
    const s = v.style;
    s.setProperty("position", "fixed", "important");
    s.setProperty("inset", "auto", "important");
    s.setProperty("left", "50%", "important");
    s.setProperty("top", "50%", "important");
    s.setProperty("width", "1280px", "important");
    s.setProperty("height", "720px", "important");
    s.setProperty("max-width", "92vw", "important");
    s.setProperty("max-height", "36vh", "important");
    s.setProperty("object-fit", "contain", "important");
    s.setProperty("object-position", "center center", "important");
    s.setProperty("background", "transparent", "important");
    s.setProperty("opacity", "1", "important");
    s.setProperty("visibility", "visible", "important");
    s.setProperty("pointer-events", "none", "important");
    s.setProperty("transform", "translate(-50%, -50%)", "important");
    s.setProperty("mix-blend-mode", "normal", "important");
    s.setProperty("z-index", "0", "important");
  }
  function live(v) {
    return !!(v && v.srcObject && v.readyState >= 2 && v.videoWidth);
  }
  function apply() {
    const v = document.getElementById("video-output");
    if (!v) return;
    if (v.parentElement !== document.body) {
      document.body.insertBefore(v, document.body.firstChild);
    }
    document.documentElement.style.background = "#000";
    document.body.style.background = "#000";
    if (!live(v)) {
      hide(v);
      return;
    }
    if (v.videoWidth > v.videoHeight) fitDecart(v);
    else fillLocal(v);
  }
  apply();
  setInterval(apply, 250);
})();
