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
  let camReq = 0;
  let currentReq = 0;
  const orig = navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);
  const PORTRAIT_MS = () => {
    const n = Number(window.__jtPortraitTimeoutMs);
    return Number.isFinite(n) && n > 0 ? n : 4000;
  };

  function markOff(userOff) {
    camEpoch += 1;
    currentReq = 0;
    window.__jtAllowCam = false;
    // Only the camera-toggle path is "user turned the camera off".
    // 换衣 / expand also call off() → markOff(), and must keep the flag.
    if (userOff) window.__jtCamUserOff = true;
  }

  function clearUserOff() {
    window.__jtCamUserOff = false;
  }

  function isEn() {
    try { return (localStorage.getItem("jt_lang") || "zh") === "en"; } catch (_) { return false; }
  }

  function camErrorText(err) {
    return (window.__jtTryonReasonFrom && window.__jtTryonReasonFrom(err))
      || (err && (err.message || String(err)))
      || (isEn() ? "Connection failed" : "连接失败");
  }

  function noFrameError() {
    return Object.assign(new Error("no camera frames"), { name: "CamNoFrame" });
  }

  function streamHasLiveVideo(stream) {
    return Boolean(stream && stream.getVideoTracks && stream.getVideoTracks().some((t) => t.readyState === "live"));
  }

  function cameraIsLive() {
    return streamHasLiveVideo(window.__jtRawStream) || streamHasLiveVideo(window.__jtVtonIn);
  }

  // Current request failed: drop stale settings / portrait and show a classified reason.
  // A stale request must still not touch those globals (P1-5).
  function failCurrent(err, stream) {
    window.__jtLastCamError = err;
    window.__jtCamSettings = null;
    if (stream) {
      try { stream.getTracks().forEach((t) => t.stop()); } catch (_) {}
      if (window.__jtRawStream === stream) window.__jtRawStream = null;
    } else if (window.__jtRawStream) {
      try { window.__jtRawStream.getTracks().forEach((t) => t.stop()); } catch (_) {}
      window.__jtRawStream = null;
    }
    if (typeof window.jtPortraitIn === "function") window.jtPortraitIn(null);
    window.__jtTryonReason?.(camErrorText(err));
  }

  function hintCamOff() {
    const shown = isEn() ? "Turn the camera on first" : "请先打开摄像头";
    window.__jtCamOffHint = shown;
    window.__jtCamOffHintEn = "Turn the camera on first";
    window.__jtTryonReason?.(shown);
  }

  function closeProductModal() {
    const modal = document.getElementById("product-modal");
    if (modal && !modal.classList.contains("hidden")) modal.classList.add("hidden");
  }

  // A stale/late request may only stop its OWN tracks. It must not clear
  // __jtRawStream / __jtCamSettings or call jtPortraitIn(null) — a newer
  // request may already own those (P1-5).
  function abortOwn(stream) {
    if (stream) {
      try { stream.getTracks().forEach((t) => t.stop()); } catch (_) {}
      if (window.__jtRawStream === stream) window.__jtRawStream = null;
    }
    const err = typeof DOMException === "function"
      ? new DOMException("Camera closed while opening", "AbortError")
      : Object.assign(new Error("Camera closed while opening"), { name: "AbortError" });
    throw err;
  }

  function isFresh(reqId, epoch) {
    return reqId === currentReq && camEpoch === epoch && window.__jtAllowCam;
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

  function withTimeout(promise, ms, err) {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(err), ms);
      Promise.resolve(promise).then(
        (v) => { clearTimeout(timer); resolve(v); },
        (e) => { clearTimeout(timer); reject(e); },
      );
    });
  }

  navigator.mediaDevices.getUserMedia = async function () {
    if (!window.__jtAllowCam) {
      return Promise.reject(Object.assign(new Error("camera gated"), { name: "NotAllowedError" }));
    }
    const epoch = camEpoch;
    const reqId = ++camReq;
    currentReq = reqId;
    window.__jtLastCamError = null;
    const picked = await pickCam();
    if (!isFresh(reqId, epoch)) abortOwn(null);
    window.__jtFromObs = !!picked.obs;
    const deviceId = picked.id ? { exact: picked.id } : undefined;
    // OBS: ask for the native 1920x1080 landscape canvas and forbid crop-and-scale.
    // Non-OBS: keep the generic portrait request used for phones / laptop webcams.
    const video = picked.obs
      ? { deviceId, width: { ideal: 1920 }, height: { ideal: 1080 }, resizeMode: "none", frameRate: { ideal: 30, max: 30 } }
      : { deviceId, width: { ideal: 720 }, height: { ideal: 1280 }, aspectRatio: { ideal: 9 / 16 }, frameRate: { ideal: 30, max: 30 } };
    let stream;
    try {
      stream = await orig({ audio: false, video });
    } catch (err) {
      if (isFresh(reqId, epoch)) failCurrent(err);
      throw err;
    }
    if (!isFresh(reqId, epoch)) abortOwn(stream);
    if (!streamHasLiveVideo(stream)) {
      const err = noFrameError();
      if (isFresh(reqId, epoch)) failCurrent(err, stream);
      else abortOwn(stream);
      throw err;
    }
    window.__jtRawStream = stream;
    recordTrackSettings(stream);
    if (typeof window.jtPortraitIn === "function") {
      try {
        await withTimeout(window.jtPortraitIn(stream), PORTRAIT_MS(), noFrameError());
      } catch (e) {
        if (isFresh(reqId, epoch)) failCurrent(e, stream);
        else abortOwn(stream);
        throw e;
      }
    }
    if (!isFresh(reqId, epoch)) abortOwn(stream);
    window.__jtLastCamError = null;
    window.dispatchEvent(new CustomEvent("jt-cam-stream", { detail: { fromObs: window.__jtFromObs, settings: window.__jtCamSettings } }));
    return stream;
  };

  function on() {
    window.__jtAllowCam = true;
    window.__jtCamUserOff = false;
  }
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
    const sessionEnd = e.target.closest("#btn-end, #btn-end-close, #btn-session-done, #btn-end-link");
    if (sessionEnd) {
      clearUserOff();
      off();
      return;
    }
    const wantsTry = e.target.closest("#btn-modal-try, .left-panel.collapsed .explore-card");
    // Intercept only when the visitor themselves turned the camera off AND it is not live.
    if (wantsTry && window.__jtCamUserOff && !cameraIsLive()) {
      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation();
      closeProductModal();
      hintCamOff();
      return;
    }
    if (e.target.closest("#btn-modal-try, #btn-cam-toggle")) on();
    if (e.target.closest(".left-panel.collapsed .explore-card")) on();
    if (e.target.closest("#btn-change, #btn-return-dot, #btn-expand-strip")) off();
  }, true);
  window.jtCamOn = on;
  window.jtCamOff = off;
  window.__jtCamGate = {
    markOff,
    clearUserOff,
    on,
    get epoch() { return camEpoch; },
    get currentReq() { return currentReq; },
    cameraIsLive,
  };
})();
