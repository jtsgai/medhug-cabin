function applyFullCabin(layout) {
  const stage = document.querySelector(".cabin-stage");
  if (!stage) return;
  const L = layout || window.__jtLayout || {};
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
  }
  const video = document.querySelector("#video-output");
  if (video) {
    video.style.objectFit = "cover";
    video.style.objectPosition = "center center";
    video.style.background = "#000";
  }
  const left = document.querySelector(".left-panel");
  if (left && !left.classList.contains("collapsed")) {
    const pct = Number(L.left_column_percent);
    const w = Number.isFinite(pct) ? Math.min(36, Math.max(22, pct)) : 28;
    left.style.position = "absolute";
    left.style.left = "12px";
    left.style.top = "4%";
    left.style.bottom = "8%";
    left.style.width = `min(${w}vw, 420px)`;
    left.style.background = "transparent";
    left.style.zIndex = "8";
  }
}
function readLayout() {
  try {
    const raw = localStorage.getItem("jt_layout_deployed");
    if (raw) return JSON.parse(raw);
  } catch (_) {}
  return window.__jtLayout || {};
}
async function boot() {
  try {
    const res = await fetch("./layout.json");
    if (res.ok) window.__jtLayout = await res.json();
  } catch (_) {}
  applyFullCabin({ ...(window.__jtLayout || {}), ...readLayout() });
  const stage = document.querySelector(".cabin-stage");
  if (stage) {
    const obs = new MutationObserver(() => applyFullCabin(readLayout()));
    obs.observe(stage, { attributes: true, attributeFilter: ["style"] });
  }
  setInterval(() => applyFullCabin(readLayout()), 800);
  if (!document.getElementById("jt-home-switch")) {
    const a = document.createElement("a");
    a.id = "jt-home-switch";
    a.href = "./home.html";
    a.textContent = "Home";
    document.body.appendChild(a);
  }
}
if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
else boot();
