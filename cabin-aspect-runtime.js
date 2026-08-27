function applyFullCabin() {
  document.documentElement.style.setProperty("--feat-max", "9999px");
  document.documentElement.style.background = "transparent";
  document.body.style.background = "transparent";
  const left = document.querySelector("#left-panel");
  if (left) {
    left.style.border = "none";
    left.style.borderRight = "none";
    left.style.outline = "none";
    left.style.boxShadow = "none";
  }
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
  let x0 = 0, tracking = false;
  zone.addEventListener("pointerdown", (e) => { x0 = e.clientX; tracking = true; });
  zone.addEventListener("pointerup", (e) => {
    if (!tracking) return;
    tracking = false;
    const dx = e.clientX - x0;
    if (Math.abs(dx) < 48) return;
    if (dx < 0) document.getElementById("btn-feat-next")?.click();
    else document.getElementById("btn-feat-prev")?.click();
  });
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
  if (!document.querySelector('link[href*="shared-dock.css"]')) {
    const l = document.createElement("link");
    l.rel = "stylesheet"; l.href = "./shared-dock.css"; document.head.appendChild(l);
  }
  if (!document.getElementById("jt-dock")) {
    const dock = document.createElement("nav");
    dock.id = "jt-dock"; dock.className = "jt-dock";
    dock.innerHTML = '<a href="./index.html" class="is-here">TRY ON</a><a href="./kids/">KIDS</a><a href="./fx/">FX</a><a href="./stage/">STAGE</a>';
    document.body.appendChild(dock);
  }
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
