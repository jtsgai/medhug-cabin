import { createDecartClient, models } from "https://esm.sh/@decartai/sdk";
import { DECART_API_KEY } from "./config.js";

const $ = (s) => document.querySelector(s);
let effects = [];
let currentId = null;
let localStream = null;
let realtimeClient = null;
let sessionActive = false;
let switching = false;
let presenceTimer = null;
let absenceSince = null;
const ABSENCE_MS = 5000;

function toast(msg) {
  const el = $("#toast");
  el.textContent = msg;
  el.classList.remove("hidden");
  clearTimeout(toast._t);
  toast._t = setTimeout(() => el.classList.add("hidden"), 2800);
}
function setStatus(text, show = true) {
  const el = $("#status");
  el.textContent = text || "";
  el.classList.toggle("hidden", !show || !text);
}
function markActive(id) {
  document.querySelectorAll(".fx-btn").forEach((b) => b.classList.toggle("active", b.dataset.id === id));
}
async function startCamera() {
  if (localStream && localStream.active) {
    $("#video-output").srcObject = localStream;
    return localStream;
  }
  if (localStream) {
    try { localStream.getTracks().forEach((t) => t.stop()); } catch (_) {}
    localStream = null;
  }
  localStream = await navigator.mediaDevices.getUserMedia({
    audio: false,
    video: { facingMode: "user", width: { ideal: 720 }, height: { ideal: 1280 }, frameRate: { ideal: 30 } },
  });
  const v = $("#video-output");
  v.srcObject = localStream;
  v.muted = true;
  await v.play().catch(() => {});
  return localStream;
}
async function ensureSession() {
  if (sessionActive && realtimeClient) return;
  if (!DECART_API_KEY || DECART_API_KEY === "YOUR_API_KEY_HERE") throw new Error("Missing API key");
  await startCamera();
  setStatus("Connecting…");
  const model = models.realtime("lucy-latest");
  const client = createDecartClient({ apiKey: DECART_API_KEY });
  realtimeClient = await client.realtime.connect(localStream, {
    model,
    mirror: "auto",
    onRemoteStream: (remote) => {
      const v = $("#video-output");
      v.srcObject = remote;
      v.muted = true;
      v.play().catch(() => {});
    },
  });
  sessionActive = true;
  startPresence();
}
async function applyEffect(id) {
  const fx = effects.find((e) => e.id === id);
  if (!fx || switching) return;
  switching = true;
  try {
    await ensureSession();
    currentId = id;
    markActive(id);
    setStatus("Applying…");
    await realtimeClient.set({ prompt: fx.prompt, enhance: true });
    setStatus("");
  } catch (e) {
    toast(String(e.message || e).slice(0, 80));
    await resetFx(false);
  } finally {
    switching = false;
  }
}
async function resetFx(show = true) {
  stopPresence();
  currentId = null;
  markActive(null);
  if (realtimeClient) {
    try { realtimeClient.disconnect(); } catch (_) {}
    realtimeClient = null;
  }
  sessionActive = false;
  switching = false;
  setStatus("");
  try { await startCamera(); } catch (_) {}
  if (show) toast("Reset");
}
function startPresence() {
  stopPresence();
  presenceTimer = setInterval(async () => {
    if (!sessionActive) return;
    const v = $("#video-output");
    let someone = true;
    try {
      if (window.FaceDetector && v.videoWidth) {
        const det = new FaceDetector({ fastMode: true, maxDetectedFaces: 1 });
        const c = document.createElement("canvas");
        c.width = 160; c.height = 90;
        c.getContext("2d").drawImage(v, 0, 0, 160, 90);
        someone = (await det.detect(c)).length > 0;
      }
    } catch (_) {}
    if (someone) absenceSince = null;
    else {
      absenceSince = absenceSince || Date.now();
      if (Date.now() - absenceSince >= ABSENCE_MS) await resetFx(false);
    }
  }, 400);
}
function stopPresence() {
  if (presenceTimer) clearInterval(presenceTimer);
  presenceTimer = null;
  absenceSince = null;
}
function renderDock() {
  const row = $("#fx-row");
  row.innerHTML = "";
  effects.forEach((fx) => {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "fx-btn";
    b.dataset.id = fx.id;
    b.textContent = fx.emoji;
    b.title = fx.label;
    b.onclick = () => applyEffect(fx.id);
    row.appendChild(b);
  });
}
async function init() {
  const res = await fetch("./effects.json");
  effects = (await res.json()).effects || [];
  renderDock();
  $("#btn-reset").onclick = () => resetFx(true);
  try { await startCamera(); } catch (e) { toast("Cannot open camera"); }
  window.addEventListener("beforeunload", () => { try { realtimeClient?.disconnect(); } catch (_) {} });
}
init();
