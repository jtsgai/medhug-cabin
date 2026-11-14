// Preview-card copy of the root cam-gate.js (root file is untouched).
// - Gates the camera until a try-on / camera-toggle click (same idea as the live page).
//
// CAM_AFTER_SESSION (one-line change, optionally overridden by ?camAfterSession=on|keep):
//   "on"   = after 完成 or hold auto-finish, idle camera turns back on (default; 288dce7 / P1-6).
//   "keep" = after session end, camera stays off; the next visitor turns it on, then 试穿.
// Portrait handshake timeout defaults to 6000ms; ?camTimeoutMs= overrides, clamped to [2000, 15000].
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
  // Idle camera after 完成 / hold auto-finish. Flip this one line to change the default.
  const CAM_AFTER_SESSION = "on";
  const PORTRAIT_TIMEOUT_DEFAULT = 6000;
  const PORTRAIT_TIMEOUT_MIN = 2000;
  const PORTRAIT_TIMEOUT_MAX = 15000;

  function camAfterSession() {
    try {
      const q = new URLSearchParams(location.search).get("camAfterSession");
      if (q === "on" || q === "keep") return q;
    } catch (_) {}
    const w = window.__jtCamAfterSession;
    if (w === "on" || w === "keep") return w;
    return CAM_AFTER_SESSION;
  }

  function resolvePortraitTimeout(search, hook) {
    const hookN = Number(hook);
    if (Number.isFinite(hookN) && hookN > 0) return hookN;
    try {
      const q = new URLSearchParams(search == null ? location.search : search).get("camTimeoutMs");
      if (q != null && q !== "") {
        const n = Number(q);
        if (Number.isFinite(n)) return Math.min(PORTRAIT_TIMEOUT_MAX, Math.max(PORTRAIT_TIMEOUT_MIN, n));
      }
    } catch (_) {}
    return PORTRAIT_TIMEOUT_DEFAULT;
  }

  const PORTRAIT_MS = () => resolvePortraitTimeout(location.search, window.__jtPortraitTimeoutMs);

  function markOff(userOff) {
    camEpoch += 1;
    currentReq = 0;
    window.__jtAllowCam = false;
    // Only the camera-toggle path is "user turned the camera off".
    // 换衣 / expand also call off() → markOff(), and must keep the flag.
    if (userOff) window.__jtCamUserOff = true;
    // P2-H: stop this request's stream immediately (toggleCamera off only called
    // markOff, not off()). P1-5: only the stream now in __jtRawStream.
    const s = window.__jtRawStream;
    if (s) {
      try { s.getTracks().forEach((t) => t.stop()); } catch (_) {}
      window.__jtRawStream = null;
    }
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
    // P2-G: failed request = camera off, so one press reopens (not a no-op "off").
    window.__jtForceCamOff?.();
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

  // 完成 / hold auto-finish only. End (#btn-end / #btn-session-done / #btn-end-link),
  // 换衣, and expand must not clear the flag or apply the idle-camera policy.
  function onSessionEnd() {
    if (camAfterSession() === "keep") {
      window.__jtCamUserOff = true;
      off();
    } else {
      off();
      on();
    }
  }

  document.addEventListener("click", (e) => {
    if (e.target.closest("#btn-end-close")) {
      onSessionEnd();
      return;
    }
    if (e.target.closest("#btn-end, #btn-session-done, #btn-end-link")) {
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
    if (e.target.closest("#btn-cam-toggle")) on();
    if (e.target.closest("#btn-modal-try, .left-panel.collapsed .explore-card")) {
      on();
      // After a failed request, cameraEnabled is false (P2-G). 试穿 must re-arm it
      // so startLocalCamera can run. Do not arm on #btn-cam-toggle (that would invert toggleCamera).
      window.__jtArmCamera?.();
    }
    if (e.target.closest("#btn-change, #btn-return-dot, #btn-expand-strip")) {
      off();
      // Re-open the gate so restoreLocalCamera can bring back the local preview
      // when the visitor did not turn the camera off. Leave it closed if they did.
      if (!window.__jtCamUserOff) on();
    }
  }, true);
  window.jtCamOn = on;
  window.jtCamOff = off;
  window.__jtCamAfterSession = camAfterSession();
  window.__jtCamGate = {
    markOff,
    clearUserOff,
    on,
    onSessionEnd,
    camAfterSession,
    resolvePortraitTimeout,
    get epoch() { return camEpoch; },
    get currentReq() { return currentReq; },
    cameraIsLive,
  };
})();
