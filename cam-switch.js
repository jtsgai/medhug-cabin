(function () {
  function place(btn) {
    if (!btn) return;
    btn.classList.remove("hidden");
    btn.style.setProperty("position", "fixed", "important");
    btn.style.setProperty("right", "20px", "important");
    btn.style.setProperty("bottom", "28px", "important");
    btn.style.setProperty("z-index", "9999", "important");
    btn.style.setProperty("pointer-events", "auto", "important");
    btn.style.setProperty("display", "block", "important");
  }
  function bind() {
    const bar = document.getElementById("btn-cam-switch");
    const fab = document.getElementById("btn-cam-toggle");
    place(fab);
    function flip(e) {
      if (e) {
        e.preventDefault();
        e.stopPropagation();
      }
      if (typeof window.toggleCamera === "function") {
        window.toggleCamera();
        return;
      }
      if (fab && !e?.currentTarget?.id?.includes("cam-toggle")) fab.click();
      else if (window.jtCamOff && window.jtCamOn) {
        const v = document.getElementById("video-output");
        const on = !!(v && v.srcObject && v.srcObject.active);
        if (on) window.jtCamOff();
        else {
          window.jtCamOn();
          window.jtCamOff && navigator.mediaDevices.getUserMedia({ video: true, audio: false })
            .then((s) => { if (v) { v.srcObject = s; v.style.visibility = "visible"; v.style.opacity = "1"; } })
            .catch(() => {});
        }
      }
    }
    if (bar && !bar._bound) {
      bar._bound = true;
      bar.addEventListener("click", flip, true);
    }
    if (fab && !fab._bound) {
      fab._bound = true;
      fab.addEventListener("click", function (e) {
        e.stopPropagation();
        if (typeof window.toggleCamera === "function") {
          e.preventDefault();
          window.toggleCamera();
        }
      }, true);
    }
  }
  bind();
  setInterval(bind, 1000);
})();
