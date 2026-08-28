(function () {
  function clearCanvas() {
    const c = document.getElementById("video-sharp");
    if (!c) return;
    const x = c.getContext("2d");
    if (x) x.clearRect(0, 0, c.width, c.height);
    c.remove();
  }
  function live(v) {
    return !!(v && v.srcObject && v.readyState >= 2 && v.videoWidth);
  }
  function apply() {
    const v = document.getElementById("video-output");
    if (!v) return;
    if (v.parentElement !== document.body) document.body.insertBefore(v, document.body.firstChild);
    if (!live(v)) {
      v.style.setProperty("opacity", "0", "important");
      v.style.setProperty("visibility", "hidden", "important");
      clearCanvas();
      return;
    }
    v.style.cssText = [
      "position:fixed",
      "inset:0",
      "width:100vw",
      "height:100vh",
      "z-index:0",
      "object-fit:cover",
      "object-position:center center",
      "background:transparent",
      "opacity:1",
      "visibility:visible",
      "pointer-events:none",
      "transform:none"
    ].join(";");
    clearCanvas();
  }
  apply();
  setInterval(apply, 250);
})();
