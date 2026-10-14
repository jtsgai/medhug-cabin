const video = document.querySelector("#halo");
const caption = document.querySelector("#caption");
const used = document.querySelector("#used-minutes");
const SHOWS = [
  "./halo/halo-halloween.mp4?v=2",
  "./halo/halo-ghost.mp4?v=1",
  "./halo/halo-bat.mp4?v=1",
  "./halo/halo-cape.mp4?v=1",
  "./halo/filo-ghost.mp4?v=1",
  "./halo/filo-pumpkin.mp4?v=1",
  "./halo/filo-bat.mp4?v=1"
];

function nextShow() {
  const pick = SHOWS[Math.floor(Math.random() * SHOWS.length)];
  video.src = pick;
  video.loop = false;
  video.play().catch(() => {});
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

video.addEventListener("ended", nextShow);
nextShow();
