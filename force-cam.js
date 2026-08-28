(function () {
  function hide(v) {
    v.style.setProperty("opacity", "0", "important");
    v.style.setProperty("visibility", "hidden", "important");
    v.style.setProperty("background", "transparent", "important");
  }
  function fillLocal(v) {
    const s = v.style;
    s.setProperty("position", "fixed", "important");
    s.setProperty("inset", "0", "important");
    s.setProperty("width", "100vw", "important");
    s.setProperty("height", "100vh", "important");
    s.setProperty("object-fit", "cover", "important");
    s.setProperty("background", "transparent", "important");
    s.setProperty("opacity", "1", "important");
    s.setProperty("visibility", "visible", "important");
    s.setProperty("pointer-events", "none", "important");
    s.setProperty("transform", "none", "important");
    s.setProperty("z-index", "0", "important");
  }
  function fitDecart(v) {
    const s = v.style;
    const w = v.videoWidth || 1280;
    const h = v.videoHeight || 720;
    s.setProperty("position", "fixed", "important");
    s.setProperty("inset", "auto", "important");
    s.setProperty("left", "50%", "important");
    s.setProperty("top", "50%", "important");
    s.setProperty("width", w + "px", "important");
    s.setProperty("height", h + "px", "important");
    s.setProperty("max-width", "92vw", "important");
    s.setProperty("max-height", "42vh", "important");
    s.setProperty("object-fit", "contain", "important");
    s.setProperty("transform", "translate(-50%, -50%)", "important");
    s.setProperty("background", "transparent", "important");
    s.setProperty("opacity", "1", "important");
    s.setProperty("visibility", "visible", "important");
    s.setProperty("pointer-events", "none", "important");
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
