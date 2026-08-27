function applyFullCabin() {
  const stage = document.querySelector(".cabin-stage");
  if (!stage) return;
  stage.style.cssText = "position:fixed;inset:0;width:100vw;height:100vh;max-width:none;max-height:none;aspect-ratio:auto;margin:0;border:0;border-radius:0;box-shadow:none;background:#000";
  document.documentElement.style.background = "#000";
  document.body.style.background = "#000";
  const cabin = document.querySelector(".cabin");
  if (cabin) {
    cabin.style.display = "block";
    cabin.style.width = "100%";
    cabin.style.height = "100%";
    cabin.style.background = "#000";
    cabin.style.gridTemplateColumns = "none";
  }
  const right = document.querySelector(".right-panel");
  if (right) {
    right.style.position = "absolute";
    right.style.inset = "0";
    right.style.width = "100%";
    right.style.height = "100%";
    right.style.background = "#000";
    right.style.zIndex = "1";
    right.style.pointerEvents = "none";
  }
  const video = document.querySelector("#video-output");
  if (video) {
    video.style.objectFit = "cover";
    video.style.objectPosition = "center center";
    video.style.background = "#000";
    video.style.pointerEvents = "none";
  }
  const left = document.querySelector(".left-panel");
  if (left && !left.classList.contains("collapsed")) {
    left.style.removeProperty("width");
    left.style.removeProperty("height");
    left.style.removeProperty("top");
    left.style.removeProperty("left");
    left.style.removeProperty("max-width");
    left.style.removeProperty("max-height");
    left.style.removeProperty("transform");
    left.style.position = "absolute";
    left.style.background = "transparent";
    left.style.zIndex = "8";
    left.style.pointerEvents = "auto";
  }
}
function ensureModeSwitch() {
  ["jt-home-switch", "jt-mode-switch", "jt-fx-switch"].forEach((id) => {
    const n = document.getElementById(id);
    if (n) n.remove();
  });
  if (document.getElementById("jt-dock")) return;
  const dock = document.createElement("nav");
  dock.id = "jt-dock";
  dock.className = "jt-dock";
  dock.innerHTML = '<a href="./" class="is-here">TRY ON</a><a href="./kids/">KIDS</a><a href="./fx/">FX</a><a href="./stage/">STAGE</a>';
  document.body.appendChild(dock);
  if (!document.querySelector('link[href*="shared-dock.css"]')) {
    const l = document.createElement("link");
    l.rel = "stylesheet";
    l.href = "./shared-dock.css";
    document.head.appendChild(l);
  }
}
function dismissAttract() {
  const layer = document.querySelector("#attract-layer");
  if (!layer) return;
  if (!layer.classList.contains("hidden")) {
    layer.click();
    layer.classList.add("hidden");
  }
}
const _bootAt = Date.now();
function boot() {
  applyFullCabin();
  ensureModeSwitch();
  dismissAttract();
  const t = setInterval(() => {
    if (Date.now() - _bootAt < 3000) dismissAttract();
    else clearInterval(t);
  }, 150);
}
if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
else boot();
