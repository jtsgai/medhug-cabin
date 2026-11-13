// Preview-card copy of the root cam-gate.js (root file is untouched).
// - Gates the camera until a try-on / camera-toggle click (same idea as the live page).
// - Picks OBS virtual camera by label, else scores Logitech/C922-style devices.
// - OBS devices request 1920x1080 with resizeMode "none" and NO 9:16 aspectRatio, so Chrome
//   does not pre-crop the landscape canvas before the ROI math runs.
// - Non-OBS devices keep the generic 720x1280 / 9:16 portrait constraints.
// - ROI itself still requires a measured 1920x1080 (vton-in-math.js); the device name never decides the crop.
// - Always awaits window.jtPortraitIn(stream) (the 720x1280 canvas pipeline) before returning.
(function () {
  window.__jtAllowCam = false;
  window.__jtRawStream = null;
  window.__jtFromObs = false;
  window.__jtCamSettings = null;
  let camEpoch = 0;
  const orig = navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);

  function markOff() {
    camEpoch += 1;
    window.__jtAllowCam = false;
  }

  function abortCam(stream) {
    if (stream) {
      try { stream.getTracks().forEach((t) => t.stop()); } catch (_) {}
    }
    if (stream && window.__jtRawStream === stream) window.__jtRawStream = null;
    if (!stream) window.__jtRawStream = null;
    window.__jtCamSettings = null;
    if (typeof window.jtPortraitIn === "function") window.jtPortraitIn(null);
    const err = typeof DOMException === "function"
      ? new DOMException("Camera closed while opening", "AbortError")
      : Object.assign(new Error("Camera closed while opening"), { name: "AbortError" });
    throw err;
  }

  function cancelled(epoch) {
    return camEpoch !== epoch || !window.__jtAllowCam;
  }

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

  function recordTrackSettings(stream) {
    const track = stream && stream.getVideoTracks && stream.getVideoTracks()[0];
    const s = track && typeof track.getSettings === "function" ? (track.getSettings() || {}) : {};
    window.__jtCamSettings = {
      width: s.width || 0,
      height: s.height || 0,
      resizeMode: s.resizeMode || "",
      frameRate: s.frameRate,
      aspectRatio: s.aspectRatio,
      deviceId: s.deviceId || "",
    };
    return window.__jtCamSettings;
  }

  navigator.mediaDevices.getUserMedia = async function () {
    if (!window.__jtAllowCam) {
      return Promise.reject(Object.assign(new Error("camera gated"), { name: "NotAllowedError" }));
    }
    const epoch = camEpoch;
    const picked = await pickCam();
    if (cancelled(epoch)) abortCam(null);
    window.__jtFromObs = !!picked.obs;
    const deviceId = picked.id ? { exact: picked.id } : undefined;
    // OBS: ask for the native 1920x1080 landscape canvas and forbid crop-and-scale.
    // Non-OBS: keep the generic portrait request used for phones / laptop webcams.
    const video = picked.obs
      ? { deviceId, width: { ideal: 1920 }, height: { ideal: 1080 }, resizeMode: "none", frameRate: { ideal: 30, max: 30 } }
      : { deviceId, width: { ideal: 720 }, height: { ideal: 1280 }, aspectRatio: { ideal: 9 / 16 }, frameRate: { ideal: 30, max: 30 } };
    const stream = await orig({ audio: false, video });
    if (cancelled(epoch)) abortCam(stream);
    window.__jtRawStream = stream;
    recordTrackSettings(stream);
    if (typeof window.jtPortraitIn === "function") {
      try { await window.jtPortraitIn(stream); } catch (e) { console.warn("[preview-card] jtPortraitIn failed", e); }
    }
    if (cancelled(epoch)) abortCam(stream);
    window.dispatchEvent(new CustomEvent("jt-cam-stream", { detail: { fromObs: window.__jtFromObs, settings: window.__jtCamSettings } }));
    return stream;
  };

  function on() { window.__jtAllowCam = true; }
  function off() {
    markOff();
    const canvasStream = window.__jtVton?.getStream?.();
    window.__jtVtonIn = null;
    window.__jtCamSettings = null;
    if (typeof window.jtPortraitIn === "function") window.jtPortraitIn(null);
    if (window.__jtRawStream) {
      try { window.__jtRawStream.getTracks().forEach((t) => t.stop()); } catch (_) {}
      window.__jtRawStream = null;
    }
    document.querySelectorAll("video").forEach((v) => {
      if (v.id === "attract-video") return;
      const s = v.srcObject;
      if (!s) return;
      // Keep the shared canvas capture stream alive; only stop camera / remote tracks.
      if (s !== canvasStream) {
        try { s.getTracks().forEach((t) => t.stop()); } catch (_) {}
      }
      v.srcObject = null;
    });
    document.getElementById("camera-off-stage")?.classList.add("hidden");
  }

  document.addEventListener("click", (e) => {
    if (e.target.closest("#btn-modal-try, #btn-cam-toggle")) on();
    if (e.target.closest(".left-panel.collapsed .explore-card")) on();
    if (e.target.closest("#btn-change, #btn-return-dot, #btn-expand-strip, #btn-end, #btn-end-close, #btn-session-done")) off();
  }, true);
  window.jtCamOn = on;
  window.jtCamOff = off;
  window.__jtCamGate = { markOff, get epoch() { return camEpoch; } };
})();
