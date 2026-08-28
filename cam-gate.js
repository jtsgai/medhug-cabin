(function () {
  window.__jtAllowCam = false;
  window.__jtRawStream = null;
  window.__jtFromObs = false;
  const orig = navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);

  async function pickCam() {
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      const cams = devices.filter((d) => d.kind === "videoinput");
      if (!cams.length) return { id: undefined, obs: false };
      const obs = cams.find((d) => /obs|virtual\s*cam/i.test(d.label || ""));
      if (obs) return { id: obs.deviceId, obs: true };
      const scored = cams.map((d) => {
        const n = (d.label || "").toLowerCase();
        let s = 0;
        if (/usb|logitech|brio|studio|4k|1080|hd|c920|c922|c930/i.test(n)) s += 5;
        if (/integrated|ir |infrared|face/i.test(n)) s -= 4;
        return { id: d.deviceId, s };
      }).sort((a, b) => b.s - a.s);
      return { id: scored[0].id, obs: false };
    } catch (_) {
      return { id: undefined, obs: false };
    }
  }

  navigator.mediaDevices.getUserMedia = async function () {
    if (!window.__jtAllowCam) {
      return Promise.reject(Object.assign(new Error("camera gated"), { name: "NotAllowedError" }));
    }
    const picked = await pickCam();
    window.__jtFromObs = !!picked.obs;
    const stream = await orig({
      audio: false,
      video: {
        deviceId: picked.id ? { exact: picked.id } : undefined,
        width: { ideal: 720 },
        height: { ideal: 1280 },
        aspectRatio: { ideal: 9 / 16 },
        frameRate: { ideal: 30, max: 30 }
      }
    });
    window.__jtRawStream = stream;
    if (typeof window.jtPortraitIn === "function") {
      try { await window.jtPortraitIn(stream); } catch (_) {}
    }
    return stream;
  };

  function on() { window.__jtAllowCam = true; }
  function off() {
    window.__jtAllowCam = false;
    window.__jtVtonIn = null;
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
    document.getElementById("camera-off-stage")?.classList.add("hidden");
  }
  document.addEventListener("click", (e) => {
    if (e.target.closest("#btn-modal-try, #btn-logo-start, .logo-hit, .fx-btn, #btn-cam-toggle, #btn-cam-switch")) on();
    if (e.target.closest(".left-panel.collapsed .explore-card")) on();
    if (e.target.closest("#btn-change, #btn-return-dot, #btn-expand-strip, #btn-end, #btn-end-close, #btn-session-done")) off();
  }, true);
  window.jtCamOn = on;
  window.jtCamOff = off;
})();
