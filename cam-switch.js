(function () {
  function video() { return document.getElementById("video-output"); }
  function fab() { return document.getElementById("btn-cam-toggle"); }
  function live() {
    const v = video();
    const s = v && v.srcObject;
    if (!s) return false;
    try { return s.getVideoTracks().some((t) => t.readyState === "live"); }
    catch (_) { return false; }
  }
  function paint() {
    const b = fab();
    if (!b) return;
    b.classList.remove("hidden");
    b.style.setProperty("display", "block", "important");
    b.style.setProperty("position", "fixed", "important");
    b.style.setProperty("right", "22px", "important");
    b.style.setProperty("bottom", "28px", "important");
    b.style.setProperty("z-index", "9999", "important");
    b.style.setProperty("pointer-events", "auto", "important");
    b.classList.toggle("is-off", !live());
  }
  async function flip(e) {
    e.preventDefault();
    e.stopPropagation();
    if (live()) {
      if (window.jtCamOff) window.jtCamOff();
      return paint();
    }
    if (window.jtCamOn) window.jtCamOn();
    try {
      const s = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: { width: { ideal: 1080 }, height: { ideal: 1920 }, frameRate: { ideal: 30 } }
      });
      const v = video();
      if (v) {
        v.srcObject = s;
        v.muted = true;
        await v.play().catch(() => {});
      }
    } catch (err) {
      console.warn("[JT] CAM", err);
    }
    paint();
  }
  function bind() {
    const b = fab();
    if (b && !b._bound) {
      b._bound = true;
      b.addEventListener("click", flip, true);
    }
    const bar = document.getElementById("btn-cam-switch");
    if (bar) bar.style.display = "none";
    paint();
  }
  bind();
  setInterval(paint, 600);
})();
