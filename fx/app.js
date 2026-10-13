import { createDecartClient, models } from "https://esm.sh/@decartai/sdk";

const $ = (s) => document.querySelector(s);
let effects = [];
let currentId = null;
let localStream = null;
let realtimeClient = null;
let sessionActive = false;
let switching = false;
let presenceTimer = null;
let absenceSince = null;
let decartToken = "";
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
function setOffVisible(show) {
  $("#btn-reset")?.classList.toggle("hidden", !show);
}
function markActive(id) {
  document.querySelectorAll(".fx-btn").forEach((b) => b.classList.toggle("active", b.dataset.id === id));
}
function attachLocal() {
  const v = $("#video-output");
  if (!v || !localStream) return;
  v.srcObject = localStream;
  v.muted = true;
  return v.play().catch(() => {});
}
async function getDecartToken() {
  const response = await fetch("https://live.medhug.ai/api/decart-token", {
    method: "POST",
    credentials: "include",
  });
  if (!response.ok) throw new Error("Not available right now");
  const data = await response.json();
  if (!data.token) throw new Error("Not available right now");
  decartToken = data.token;
  return decartToken;
}
async function startCamera() {
  if (localStream && localStream.active) {
    await attachLocal();
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
  await attachLocal();
  return localStream;
}
async function ensureSession() {
  if (sessionActive && realtimeClient) return;
  await getDecartToken();
  await startCamera();
  setStatus("Connecting…");
  const model = models.realtime("lucy-latest");
  const client = createDecartClient({ apiKey: decartToken });
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
  setOffVisible(true);
  startPresence();
}
async function applyEffect(id) {
  const fx = effects.find((e) => e.id === id);
  if (!fx || switching) return;
  switching = true;
  try {
    window.UsageClient?.start("fx");
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
  window.UsageClient?.stop("fx");
  stopPresence();
  currentId = null;
  markActive(null);
  setOffVisible(false);
  if (realtimeClient) {
    try { realtimeClient.disconnect(); } catch (_) {}
    realtimeClient = null;
  }
  sessionActive = false;
  switching = false;
  setStatus("");
  await new Promise((r) => setTimeout(r, 80));
  try {
    if (localStream && localStream.active) await attachLocal();
    else await startCamera();
  } catch (_) {}
  if (show) toast("Effect off");
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
function renderButtons(row, list) {
  row.innerHTML = "";
  list.forEach((fx) => {
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
  const data = await res.json();
  const left = data.effects || [];
  const right = data.halloween || [];
  effects = left.concat(right);
  renderButtons($("#fx-row"), left);
  renderButtons($("#fx-halloween"), right);
  setOffVisible(false);
  $("#btn-reset").onclick = () => resetFx(true);
  $("#btn-reset").textContent = "OFF";
  try { await startCamera(); } catch (e) { toast("Cannot open camera"); }
  window.addEventListener("beforeunload", () => { try { realtimeClient?.disconnect(); } catch (_) {} });
}
init();
