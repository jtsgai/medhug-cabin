function applyFullCabin() {
  document.documentElement.style.setProperty("--feat-max", "9999px");
  document.documentElement.style.background = "transparent";
  document.body.style.background = "transparent";
  ["cabin-stage", "cabin", "right-panel"].forEach((cls) => {
    const el = document.querySelector("." + cls);
    if (!el) return;
    el.style.background = "transparent";
  });
  const video = document.querySelector("#video-output");
  if (video) video.style.background = "transparent";
  const featImg = document.querySelector("#featured-slot img");
  if (featImg) {
    featImg.style.maxHeight = "none";
    featImg.style.width = "100%";
    featImg.style.height = "100%";
    featImg.style.objectFit = "cover";
  }
  const wrap = document.querySelector(".explore-wrap");
  const list = document.querySelector("#explore-list");
  if (wrap && list && !document.querySelector(".left-panel.collapsed")) {
    const h = Math.max(80, wrap.clientHeight || 0);
    list.style.height = h + "px";
    list.querySelectorAll(".explore-page").forEach((p) => {
      p.style.height = h + "px";
      p.style.minHeight = h + "px";
      p.style.maxHeight = h + "px";
      p.style.display = "grid";
      p.style.gridTemplateColumns = "1fr 1fr";
      p.style.gridTemplateRows = "1fr 1fr";
      p.style.overflow = "hidden";
    });
  }
}
function bindFeaturedSwipe() {
  const zone = document.querySelector("#zone-featured");
  if (!zone || zone._swipeBound) return;
  zone._swipeBound = true;
  let x0 = 0, y0 = 0, tracking = false;
  const start = (x, y) => { x0 = x; y0 = y; tracking = true; };
  const end = (x, y) => {
    if (!tracking) return;
    tracking = false;
    const dx = x - x0, dy = y - y0;
    if (Math.abs(dx) < 48 || Math.abs(dx) < Math.abs(dy)) return;
    if (dx < 0) document.getElementById("btn-feat-next")?.click();
    else document.getElementById("btn-feat-prev")?.click();
  };
  zone.addEventListener("pointerdown", (e) => start(e.clientX, e.clientY));
  zone.addEventListener("pointerup", (e) => end(e.clientX, e.clientY));
  zone.addEventListener("touchstart", (e) => start(e.changedTouches[0].clientX, e.changedTouches[0].clientY), { passive: true });
  zone.addEventListener("touchend", (e) => end(e.changedTouches[0].clientX, e.changedTouches[0].clientY));
}
function bindModalBlankClose() {
  const modal = document.getElementById("product-modal");
  if (!modal || modal._blankBound) return;
  modal._blankBound = true;
  modal.addEventListener("click", (e) => {
    if (e.target === modal) document.getElementById("btn-modal-cancel")?.click();
  });
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
}
function boot() {
  applyFullCabin();
  bindFeaturedSwipe();
  bindModalBlankClose();
  ensureModeSwitch();
  setInterval(applyFullCabin, 800);
}
if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
else boot();
