(function () {
  window.__jtAllowCam = false;
  window.__jtRawStream = null;
  const orig = navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);

  async function pickCam() {
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      const cams = devices.filter((d) => d.kind === "videoinput");
      if (!cams.length) return undefined;
      const obs = cams.find((d) => /obs|virtual\s*cam/i.test(d.label || ""));
      if (obs) return obs.deviceId;
      const scored = cams.map((d) => {
        const n = (d.label || "").toLowerCase();
        let s = 0;
        if (/usb|logitech|brio|studio|4k|1080|hd|c920|c922|c930/i.test(n)) s += 5;
        if (/integrated|ir |infrared|face/i.test(n)) s -= 4;
        return { id: d.deviceId, s };
      }).sort((a, b) => b.s - a.s);
      return scored[0].id;
    } catch (_) {
      return undefined;
    }
  }

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

  function wrap(stream) {
    window.__jtRawStream = stream;
    const track = stream.getVideoTracks()[0];
    const set = (track && track.getSettings && track.getSettings()) || {};
    const w = set.width || 0;
    const h = set.height || 0;
    if (h >= w && h >= 720) return stream;
    return portraitize(stream);
  }

  navigator.mediaDevices.getUserMedia = async function () {
    if (!window.__jtAllowCam) {
      return Promise.reject(Object.assign(new Error("camera gated"), { name: "NotAllowedError" }));
    }
    const id = await pickCam();
    const video = {
      width: { ideal: 1080 },
      height: { ideal: 1920 },
      frameRate: { ideal: 30, max: 30 }
    };
    if (id) video.deviceId = { ideal: id };
    let stream;
    try {
      stream = await orig({ audio: false, video });
    } catch (_) {
      stream = await orig({
        audio: false,
        video: {
          deviceId: id ? { ideal: id } : undefined,
          width: { ideal: 1920 },
          height: { ideal: 1080 },
          frameRate: { ideal: 30, max: 30 }
        }
      });
    }
    return wrap(stream);
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
