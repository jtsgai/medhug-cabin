const halo = document.querySelector("#halo");
const caption = document.querySelector("#caption");
const used = document.querySelector("#used-minutes");
const frames = ["./halo/halo-idle.png", "./halo/halo-wave.png", "./halo/halo-run.png", "./halo/halo-wave.png"];
let frame = 0;
let live = false;
let billing = false;
let presentSince = 0;
let absentSince = 0;
let video = null;

function setLive(on) {
  live = on;
  document.querySelector(".stage").classList.toggle("live", on);
  caption.textContent = on ? "Halo is on stage" : "Halo";
  if (on && !billing) {
    window.UsageClient?.start("stage");
    billing = true;
  } else if (!on && billing) {
    window.UsageClient?.stop("stage");
    billing = false;
  }
}

setInterval(() => {
  if (!live) {
    halo.src = frames[0];
    return;
  }
  frame = (frame + 1) % frames.length;
  halo.src = frames[frame];
}, 700);

async function refreshUsed() {
  try {
    const r = await fetch("https://live.medhug.ai/api/cabin-owner", { credentials: "include" });
    if (!r.ok) return;
    const d = await r.json();
    used.textContent = "Used " + (d.used_minutes ?? d.tryon_minutes ?? 0) + " min";
  } catch (_) {}
}
refreshUsed();
setInterval(refreshUsed, 20000);

async function seen() {
  if (!window.FaceDetector || !video || !video.videoWidth) return false;
  try {
    const det = new FaceDetector({ fastMode: true, maxDetectedFaces: 1 });
    const snap = document.createElement("canvas");
    snap.width = 160; snap.height = 90;
    snap.getContext("2d").drawImage(video, 0, 0, 160, 90);
    return (await det.detect(snap)).length > 0;
  } catch (_) { return false; }
}

async function watch() {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: false, video: { facingMode: "user", width: { ideal: 320 }, height: { ideal: 240 } } });
    video = document.createElement("video");
    video.playsInline = true; video.muted = true; video.srcObject = stream;
    await video.play().catch(() => {});
  } catch (_) {}
  setInterval(async () => {
    const now = performance.now();
    const person = await seen();
    if (person) {
      absentSince = 0;
      if (!presentSince) presentSince = now;
      if (!live && now - presentSince > 1200) setLive(true);
    } else {
      presentSince = 0;
      if (!absentSince) absentSince = now;
      if (live && now - absentSince > 8000) setLive(false);
    }
  }, 500);
}
watch();
window.addEventListener("pagehide", () => { if (billing) window.UsageClient?.stop("stage"); });
