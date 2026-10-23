const video = document.querySelector("#halo");
const caption = document.querySelector("#caption");
const used = document.querySelector("#used-minutes");
const stage = document.querySelector(".stage");
const stageName = document.querySelector("#stage-name");
const stageKicker = document.querySelector("#stage-kicker");
const stageOptions = [...document.querySelectorAll(".stage-option")];
let activeRenderer = null;

// The 3D Gaussian Splatting scene will replace the video playlist only after a
// checked, compressed scene asset is supplied. These video playlists are the
// lightweight, dependable fallback for every browser and the current Stage.
const STAGES = {
  classic: {
    name: "Stage Gallery",
    kicker: "JT STAGE",
    caption: "Stage",
    shows: [
      "./halo/halo-halloween.mp4?v=2",
      "./halo/halo-ghost.mp4?v=1",
      "./halo/halo-bat.mp4?v=1",
      "./halo/halo-cape.mp4?v=1",
      "./halo/filo-ghost.mp4?v=1",
      "./halo/filo-pumpkin.mp4?v=1",
      "./halo/filo-bat.mp4?v=1"
    ]
  },
  halloween: {
    name: "Haunted Signal Observatory",
    kicker: "HALLOWEEN 2026",
    caption: "Haunted Signal",
    shows: [
      "./halo/halo-halloween.mp4?v=2",
      "./halo/halo-ghost.mp4?v=1",
      "./halo/halo-bat.mp4?v=1",
      "./halo/halo-cape.mp4?v=1",
      "./halo/filo-ghost.mp4?v=1",
      "./halo/filo-pumpkin.mp4?v=1",
      "./halo/filo-bat.mp4?v=1"
    ]
  },
  aurora: {
    name: "Aurora Memory Garden",
    kicker: "EVERYDAY STAGE",
    caption: "Aurora Garden",
    shows: [
      "./halo/halo-halloween.mp4?v=2",
      "./halo/halo-ghost.mp4?v=1",
      "./halo/halo-bat.mp4?v=1",
      "./halo/halo-cape.mp4?v=1",
      "./halo/filo-ghost.mp4?v=1",
      "./halo/filo-pumpkin.mp4?v=1",
      "./halo/filo-bat.mp4?v=1"
    ]
  }
};

const savedTheme = localStorage.getItem("jt-stage-theme");
let activeTheme = savedTheme in STAGES ? savedTheme : "classic";
let last = -1;

function nextShow() {
  if (activeRenderer) return;
  const current = STAGES[activeTheme];
  let i = Math.floor(Math.random() * current.shows.length);
  if (current.shows.length > 1 && i === last) i = (i + 1) % current.shows.length;
  last = i;
  video.src = current.shows[i];
  video.loop = false;
  video.play().catch(() => {});
  if (caption) caption.textContent = current.caption;
}

function stopStageRenderer() {
  activeRenderer = null;
  window.HauntedSignal?.stop();
  window.AuroraGarden?.stop();
  stage.dataset.signalScene = "off";
  stage.dataset.auroraScene = "off";
}

function startStageRenderer(key, attribute) {
  const renderer = window[key];
  if (!renderer) return false;
  const started = renderer.start(() => {
    if (activeRenderer !== key) return;
    activeRenderer = null;
    stage.dataset[attribute] = "fallback";
    nextShow();
  });
  activeRenderer = started ? key : null;
  stage.dataset[attribute] = started ? "ready" : "fallback";
  return Boolean(started);
}

function setTheme(theme, shouldPlay = true) {
  if (!(theme in STAGES)) return;
  stopStageRenderer();
  activeTheme = theme;
  last = -1;
  localStorage.setItem("jt-stage-theme", theme);
  stage.dataset.stageTheme = theme;
  stageName.textContent = STAGES[theme].name;
  stageKicker.textContent = STAGES[theme].kicker;
  for (const option of stageOptions) {
    const selected = option.dataset.stageTheme === theme;
    option.setAttribute("aria-pressed", String(selected));
  }
  if (!shouldPlay) return;
  const renderer = theme === "halloween" ? ["HauntedSignal", "signalScene"] : theme === "aurora" ? ["AuroraGarden", "auroraScene"] : null;
  if (renderer && startStageRenderer(renderer[0], renderer[1])) {
    video.pause();
    video.removeAttribute("src");
    video.load();
    if (caption) caption.textContent = STAGES[theme].caption;
    return;
  }
  nextShow();
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
video.addEventListener("error", () => setTimeout(nextShow, 800));
for (const option of stageOptions) {
  option.addEventListener("click", () => setTheme(option.dataset.stageTheme));
}
setTheme(activeTheme);
