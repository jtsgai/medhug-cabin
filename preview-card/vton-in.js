// Dedicated Lucy input pipeline for /preview-card/ (does NOT touch the root vton-portrait.js).
// One offscreen 720x1280 canvas -> one captureStream -> used for BOTH the local preview and Lucy.
// Display-mode switches never call into this file (CSS only).
import {
  CANVAS_W, CANVAS_H, FILL_COLOR, STATUS_LABELS, computeVtonLayout, resolveFps,
  STATUS_OBS_CONTAIN,
} from "./vton-in-math.js";

const params = new URLSearchParams(location.search);
const PRESET_KEY = "jt_preview_obs_preset";

let canvas = null;
let ctx = null;
let srcVideo = null;
let tiny = null;
let tinyCtx = null;
let rafId = 0;
let lastDrawAt = 0;
let outStream = null;
let layout = null;
let layoutKey = "";
let fps = 20;

function readInitialPreset() {
  const q = params.get("obs");
  if (q === "0" || q === "off") return false;
  if (q === "1" || q === "on") return true;
  try {
    const saved = localStorage.getItem(PRESET_KEY);
    if (saved === "0") return false;
  } catch (_) { /* ignore */ }
  return true; // default: OBS preset enabled (still requires a measured 1920x1080)
}

let obsPresetEnabled = readInitialPreset();

function currentFps() {
  return resolveFps(window.__jtVtonFps ?? params.get("fps"));
}

function backdropMode() {
  return String(window.__jtVtonBackdrop ?? params.get("backdrop") ?? "blur");
}

function ensure() {
  if (canvas) return;
  canvas = document.createElement("canvas");
  canvas.id = "vton-in-canvas";
  canvas.width = CANVAS_W;
  canvas.height = CANVAS_H;
  canvas.style.display = "none";
  document.body.appendChild(canvas);
  ctx = canvas.getContext("2d", { alpha: false });
  ctx.fillStyle = FILL_COLOR;
  ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

  // Tiny canvas: upscaling it is a very cheap blur for the letterbox backdrop.
  tiny = document.createElement("canvas");
  tiny.width = 36;
  tiny.height = 64;
  tinyCtx = tiny.getContext("2d", { alpha: false });

  srcVideo = document.createElement("video");
  srcVideo.muted = true;
  srcVideo.playsInline = true;
  srcVideo.autoplay = true;
  const kick = () => { refreshLayout(); drawFrame(); };
  srcVideo.addEventListener("loadedmetadata", kick);
  srcVideo.addEventListener("resize", kick); // track size changed: never keep a stale ROI
}

function publish(next) {
  const key = [next.status, next.reason, next.videoWidth, next.videoHeight, next.obsPresetEnabled, next.fps].join("|");
  layout = next;
  if (key === layoutKey) return;
  layoutKey = key;
  const detail = {
    status: next.status,
    reason: next.reason,
    label: STATUS_LABELS[next.reason] || "",
    videoWidth: next.videoWidth,
    videoHeight: next.videoHeight,
    obsPresetEnabled: next.obsPresetEnabled,
    fromObsDevice: Boolean(window.__jtFromObs),
    fps: next.fps,
    src: next.src,
    dst: next.dst,
  };
  window.__jtVtonStatus = detail;
  window.dispatchEvent(new CustomEvent("jt-vton-status", { detail }));
}

function refreshLayout() {
  const vw = srcVideo ? srcVideo.videoWidth : 0;
  const vh = srcVideo ? srcVideo.videoHeight : 0;
  publish(computeVtonLayout(vw, vh, { obsPresetEnabled, fps }));
  return layout;
}

function drawBackdrop(l) {
  // Soft, dimmed copy of the person region behind the contained image so the padding is not a hard black bar.
  const { sx, sy, sw, sh } = l.src;
  const target = tiny.width / tiny.height;
  let cx = sx, cy = sy, cw = sw, ch = sh;
  if (sw / sh > target) { cw = sh * target; cx = sx + (sw - cw) / 2; } else { ch = sw / target; cy = sy + (sh - ch) / 2; }
  tinyCtx.drawImage(srcVideo, cx, cy, cw, ch, 0, 0, tiny.width, tiny.height);
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(tiny, 0, 0, tiny.width, tiny.height, 0, 0, CANVAS_W, CANVAS_H);
  ctx.fillStyle = "rgba(14,14,14,0.78)";
  ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
}

function drawFrame() {
  if (!canvas || !srcVideo) return;
  const l = refreshLayout();
  if (!l.src || !l.dst) return;
  const { sx, sy, sw, sh } = l.src;
  const { dx, dy, dw, dh } = l.dst;
  if (l.status === STATUS_OBS_CONTAIN) {
    ctx.fillStyle = FILL_COLOR;
    ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
    if (l.backdrop && backdropMode() !== "none") drawBackdrop(l);
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(srcVideo, sx, sy, sw, sh, dx, dy, dw, dh);
  } else {
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(srcVideo, sx, sy, sw, sh, dx, dy, dw, dh);
  }
}

function tick(ts) {
  rafId = requestAnimationFrame(tick);
  // Throttle to the target fps (source can be 60fps; no need to burn CPU redrawing at 60).
  if (ts - lastDrawAt < 1000 / fps - 2) return;
  lastDrawAt = ts;
  drawFrame();
}

function stopLoop() {
  cancelAnimationFrame(rafId);
  rafId = 0;
}

function streamIsLive(s) {
  return Boolean(s && s.getVideoTracks().some((t) => t.readyState === "live"));
}

async function fromStream(stream) {
  if (!stream) {
    stopLoop();
    if (srcVideo) srcVideo.srcObject = null;
    window.__jtVtonIn = null;
    if (canvas) refreshLayout();
    return null;
  }
  ensure();
  fps = currentFps();
  srcVideo.srcObject = stream;
  await srcVideo.play().catch(() => {});
  stopLoop();
  refreshLayout();
  drawFrame();
  rafId = requestAnimationFrame(tick);
  // Reuse the same canvas stream across camera restarts so the preview/Lucy track stays stable.
  if (!streamIsLive(outStream)) outStream = canvas.captureStream(fps);
  window.__jtVtonIn = outStream;
  window.dispatchEvent(new CustomEvent("jt-vton-stream", { detail: { stream: outStream } }));
  return outStream;
}

function setObsPreset(on) {
  obsPresetEnabled = Boolean(on);
  try { localStorage.setItem(PRESET_KEY, obsPresetEnabled ? "1" : "0"); } catch (_) { /* ignore */ }
  if (canvas) { refreshLayout(); drawFrame(); } else {
    publish(computeVtonLayout(0, 0, { obsPresetEnabled, fps: currentFps() }));
  }
  return obsPresetEnabled;
}

// Used by the patched showLocalPreview(): run cb once the canvas stream exists (or give up after timeoutMs).
function whenVtonIn(cb, timeoutMs = 3000) {
  if (window.__jtVtonIn) return cb();
  const done = () => { clearTimeout(timer); window.removeEventListener("jt-vton-stream", done); cb(); };
  const timer = setTimeout(() => window.removeEventListener("jt-vton-stream", done), timeoutMs);
  window.addEventListener("jt-vton-stream", done);
}

// Never let the pinned core fall back to the raw 1920x1080 stream when connecting to Lucy.
function requireVtonIn() {
  if (!window.__jtVtonIn) throw new Error("vton input not ready");
  return window.__jtVtonIn;
}

window.jtPortraitIn = fromStream;
window.__jtWhenVtonIn = whenVtonIn;
window.__jtRequireVtonIn = requireVtonIn;
window.__jtVton = {
  computeVtonLayout,
  setObsPreset,
  getObsPreset: () => obsPresetEnabled,
  getLayout: () => layout,
  getStatus: () => window.__jtVtonStatus,
  getCanvas: () => canvas,
  getStream: () => outStream,
  // Test hook: feed a synthetic MediaStream (e.g. canvas.captureStream()) through the real pipeline.
  feed: fromStream,
  drawNow: drawFrame,
};

publish(computeVtonLayout(0, 0, { obsPresetEnabled, fps: currentFps() }));
