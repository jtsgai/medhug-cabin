const video = document.querySelector("#halo");
const caption = document.querySelector("#caption");
const used = document.querySelector("#used-minutes");
let billing = false;
let presentSince = 0;
let absentSince = 0;
let cam = null;

function setBilling(on) {
  if (on && !billing) {
    window.UsageClient?.start("stage");
    billing = true;
    caption.textContent = "Halo is on stage";
  } else if (!on && billing) {
    window.UsageClient?.stop("stage");
    billing = false;
    caption.textContent = "Halo";
  }
}

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
  if (!window.FaceDetector || !cam || !cam.videoWidth) return false;
  try {
    const det = new FaceDetector({ fastMode: true, maxDetectedFaces: 1 });
    const snap = document.createElement("canvas");
    snap.width = 160; snap.height = 90;
    snap.getContext("2d").drawImage(cam, 0, 0, 160, 90);
    return (await det.detect(snap)).length > 0;
  } catch (_) { return false; }
}

async function watch() {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: false, video: { facingMode: "user", width: { ideal: 320 }, height: { ideal: 240 } } });
    cam = document.createElement("video");
    cam.playsInline = true; cam.muted = true; cam.srcObject = stream;
    await cam.play().catch(() => {});
  } catch (_) {}
  setInterval(async () => {
    const now = performance.now();
    const person = await seen();
    if (person) {
      absentSince = 0;
      if (!presentSince) presentSince = now;
      if (!billing && now - presentSince > 1200) setBilling(true);
    } else {
      presentSince = 0;
      if (!absentSince) absentSince = now;
      if (billing && now - absentSince > 8000) setBilling(false);
    }
  }, 500);
}
watch();
video.play().catch(() => {});
window.addEventListener("pagehide", () => setBilling(false));
