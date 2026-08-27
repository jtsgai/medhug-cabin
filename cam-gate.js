(function () {
  window.__jtAllowCam = false;
  const orig = navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);
  navigator.mediaDevices.getUserMedia = function (constraints) {
    if (!window.__jtAllowCam) {
      return Promise.reject(Object.assign(new Error("camera gated"), { name: "NotAllowedError" }));
    }
    const video = {
      width: { ideal: 1920 },
      height: { ideal: 1080 },
      frameRate: { ideal: 30, max: 30 }
    };
    if (constraints && constraints.video && constraints.video.deviceId) {
      video.deviceId = constraints.video.deviceId;
    }
    return orig({ audio: false, video });
  };
  function on() { window.__jtAllowCam = true; }
  function off() {
    window.__jtAllowCam = false;
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
