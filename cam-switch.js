(function () {
  function fab() { return document.getElementById("btn-cam-toggle"); }
  function btn() { return document.getElementById("btn-cam-switch"); }
  function video() { return document.getElementById("video-output"); }
  function offStage() { return document.getElementById("camera-off-stage"); }
  function live() {
    const v = video();
    const s = v && v.srcObject;
    if (!s) return false;
    try {
      return s.getVideoTracks().some((t) => t.readyState === "live");
    } catch (_) {
      return false;
    }
  }
  function hideFab() {
    const f = fab();
    if (!f) return;
    f.classList.add("hidden");
    f.style.setProperty("display", "none", "important");
  }
  function paint() {
    const b = btn();
    if (!b) return;
    const on = live();
    b.textContent = on ? "CAM ON" : "CAM OFF";
    b.style.opacity = on ? "1" : "0.45";
  }
  async function flip(e) {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    const v = video();
    if (live()) {
      if (typeof window.jtCamOff === "function") window.jtCamOff();
      if (v && v.srcObject) {
        try { v.srcObject.getTracks().forEach((t) => t.stop()); } catch (_) {}
        v.srcObject = null;
      }
      offStage()?.classList.remove("hidden");
    } else {
      if (typeof window.jtCamOn === "function") window.jtCamOn();
      try {
        const s = await navigator.mediaDevices.getUserMedia({
          audio: false,
          video: { width: { ideal: 1080 }, height: { ideal: 1920 }, frameRate: { ideal: 30 } }
        });
        if (v) {
          v.srcObject = s;
          v.muted = true;
          await v.play().catch(() => {});
        }
        offStage()?.classList.add("hidden");
      } catch (err) {
        console.warn("[JT] CAM", err);
      }
    }
    paint();
  }
  function bind() {
    hideFab();
    const b = btn();
    if (b && !b._jtCamBound) {
      b._jtCamBound = true;
      b.addEventListener("click", flip, true);
    }
    paint();
  }
  bind();
  setInterval(bind, 1000);
})();
