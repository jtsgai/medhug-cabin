(function () {
  window.__jtAllowCam = false;
  window.__jtRawStream = null;
  const orig = navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);

  function portraitize(stream) {
    window.__jtRawStream = stream;
    const inv = document.createElement("video");
    inv.setAttribute("playsinline", "");
    inv.muted = true;
    inv.srcObject = stream;
    inv.play().catch(() => {});
    const c = document.createElement("canvas");
    c.width = 1080;
    c.height = 1920;
    const x = c.getContext("2d");
    (function loop() {
      if (inv.readyState >= 2 && inv.videoWidth) {
        x.save();
        x.translate(540, 960);
        x.rotate(-Math.PI / 2);
        x.drawImage(inv, -inv.videoWidth / 2, -inv.videoHeight / 2, inv.videoWidth, inv.videoHeight);
        x.restore();
      }
      requestAnimationFrame(loop);
    })();
    return c.captureStream(30);
  }

  navigator.mediaDevices.getUserMedia = function () {
    if (!window.__jtAllowCam) {
      return Promise.reject(Object.assign(new Error("camera gated"), { name: "NotAllowedError" }));
    }
    return orig({
      audio: false,
      video: {
        width: { ideal: 1920 },
        height: { ideal: 1080 },
        frameRate: { ideal: 30, max: 30 }
      }
    }).then(portraitize);
  };

  function on() { window.__jtAllowCam = true; }
  function off() {
    window.__jtAllowCam = false;
    if (window.__jtRawStream) {
      try { window.__jtRawStream.getTracks().forEach((t) => t.stop()); } catch (_) {}
      window.__jtRawStream = null;
    }
    document.querySelectorAll("video").forEach((v) => {
      if (v.id === "attract-video") return;
      const s = v.srcObject;
      if (!s) return;
      try { s.getTracks().forEach((t) => t.stop()); } catch (_) {}
      v.srcObject = null;
    });
  }
  document.addEventListener("click", (e) => {
    if (e.target.closest("#btn-modal-try, #btn-logo-start, .logo-hit, .fx-btn, #btn-cam-toggle")) on();
    if (e.target.closest(".left-panel.collapsed .explore-card")) on();
    if (e.target.closest("#btn-end, #btn-end-close, #btn-session-done, #btn-change, #btn-return-dot, #btn-expand-strip, #btn-stop, #btn-reset")) off();
  }, true);
  window.jtCamOn = on;
  window.jtCamOff = off;
})();
