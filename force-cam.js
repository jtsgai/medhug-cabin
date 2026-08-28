(function () {
  /* LOCKED: display the <video> directly. No canvas, no CSS rotate.
     Local OBS and Decart frames are already upright. Cover-fill the cabin.
     Hide the layer when the stream stops. */
  function hide(v) {
    v.style.setProperty("opacity", "0", "important");
    v.style.setProperty("visibility", "hidden", "important");
  }
  function fill(v) {
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
    s.setProperty("background", "transparent", "important");
    s.setProperty("opacity", "1", "important");
    s.setProperty("visibility", "visible", "important");
    s.setProperty("pointer-events", "none", "important");
    s.setProperty("transform", "none", "important");
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
    if (!live(v)) hide(v);
    else fill(v);
  }
  apply();
  setInterval(apply, 250);
})();
