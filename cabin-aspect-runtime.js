function applyFullCabin() {
  document.documentElement.style.setProperty("--feat-max", "9999px");
  document.documentElement.style.background = "transparent";
  document.body.style.background = "transparent";
  const stage = document.querySelector(".cabin-stage");
  if (stage) {
    stage.style.background = "transparent";
    stage.style.position = "fixed";
    stage.style.inset = "0";
    stage.style.width = "100vw";
    stage.style.height = "100vh";
  }
  const cabin = document.querySelector(".cabin");
  if (cabin) {
    cabin.style.display = "block";
    cabin.style.width = "100%";
    cabin.style.height = "100%";
    cabin.style.background = "transparent";
    cabin.style.gridTemplateColumns = "none";
  }
  const right = document.querySelector(".right-panel");
  if (right) {
    right.style.position = "absolute";
    right.style.inset = "0";
    right.style.width = "100%";
    right.style.height = "100%";
    right.style.background = "transparent";
    right.style.zIndex = "1";
    right.style.pointerEvents = "none";
  }
  const video = document.querySelector("#video-output");
  if (video) {
    video.style.objectFit = "cover";
    video.style.background = "transparent";
    video.style.pointerEvents = "none";
  }
  const left = document.querySelector(".left-panel");
  if (left && !left.classList.contains("collapsed")) {
    ["width", "height", "top", "left", "max-width", "max-height", "transform"].forEach((p) => left.style.removeProperty(p));
    left.style.position = "absolute";
    left.style.background = "transparent";
    left.style.zIndex = "8";
    left.style.pointerEvents = "auto";
  }
  const featImg = document.querySelector("#featured-slot img");
  if (featImg) {
    featImg.style.maxHeight = "none";
    featImg.style.width = "100%";
    featImg.style.height = "100%";
    featImg.style.objectFit = "cover";
    featImg.style.objectPosition = "center top";
    featImg.style.background = "transparent";
  }
  const wrap = document.querySelector(".explore-wrap");
  const list = document.querySelector("#explore-list");
  if (wrap && list && !document.querySelector(".left-panel.collapsed")) {
    const h = Math.max(80, wrap.clientHeight || 0);
    list.style.height = h + "px";
    list.style.overflowY = "auto";
    list.querySelectorAll(".explore-page").forEach((p) => {
      p.style.boxSizing = "border-box";
      p.style.width = "100%";
      p.style.height = h + "px";
      p.style.minHeight = h + "px";
      p.style.maxHeight = h + "px";
      p.style.display = "grid";
      p.style.gridTemplateColumns = "1fr 1fr";
      p.style.gridTemplateRows = "1fr 1fr";
      p.style.gap = "6px";
      p.style.padding = "0";
      p.style.margin = "0";
      p.style.overflow = "hidden";
      p.style.scrollSnapAlign = "start";
      p.querySelectorAll(".explore-card").forEach((c) => {
        c.style.width = "auto";
        c.style.height = "auto";
        c.style.maxWidth = "none";
        c.style.maxHeight = "none";
        const img = c.querySelector("img");
        if (img) {
          img.style.width = "100%";
          img.style.height = "100%";
          img.style.objectFit = "cover";
          img.style.background = "transparent";
        }
      });
    });
  }
}
function ensureModeSwitch() {
  ["jt-home-switch", "jt-mode-switch", "jt-fx-switch"].forEach((id) => {
    const n = document.getElementById(id); if (n) n.remove();
  });
  if (document.getElementById("jt-dock")) return;
  const dock = document.createElement("nav");
  dock.id = "jt-dock"; dock.className = "jt-dock";
  dock.innerHTML = '<a href="./index.html">TRY ON</a><a href="./kids/">KIDS</a><a href="./fx/">FX</a><a href="./stage/">STAGE</a>';
  document.body.appendChild(dock);
  if (!document.querySelector('link[href*="shared-dock.css"]')) {
    const l = document.createElement("link"); l.rel = "stylesheet"; l.href = "./shared-dock.css"; document.head.appendChild(l);
  }
}
function dismissAttract() {
  const layer = document.querySelector("#attract-layer");
  if (layer && !layer.classList.contains("hidden")) {
    layer.click(); layer.classList.add("hidden");
  }
}
function boot() {
  applyFullCabin();
  ensureModeSwitch();
  dismissAttract();
  setInterval(applyFullCabin, 800);
}
if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
else boot();
