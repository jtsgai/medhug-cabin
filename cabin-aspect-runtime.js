function applyFullCabin(layout) {
  const stage = document.querySelector(".cabin-stage");
  if (!stage) return;
  stage.style.cssText = "position:fixed;inset:0;width:100vw;height:100vh;max-width:none;max-height:none;aspect-ratio:auto;margin:0;border:0;border-radius:0;box-shadow:none;background:#000";
  document.documentElement.style.background = "#000";
  document.body.style.background = "#000";
  const cabin = document.querySelector(".cabin");
  if (cabin) {
    cabin.style.display = "block"; cabin.style.width = "100%"; cabin.style.height = "100%";
    cabin.style.background = "#000"; cabin.style.gridTemplateColumns = "none";
  }
  const right = document.querySelector(".right-panel");
  if (right) {
    right.style.position = "absolute"; right.style.inset = "0";
    right.style.width = "100%"; right.style.height = "100%";
    right.style.background = "#000"; right.style.zIndex = "1";
  }
  const video = document.querySelector("#video-output");
  if (video) {
    video.style.objectFit = "cover"; video.style.objectPosition = "center center"; video.style.background = "#000";
  }
  const left = document.querySelector(".left-panel");
  if (left && !left.classList.contains("collapsed")) {
    left.style.position = "absolute"; left.style.left = "8px"; left.style.top = "2%";
    left.style.width = "260px"; left.style.background = "transparent"; left.style.zIndex = "8";
    left.style.transform = "scale(1.5)"; left.style.transformOrigin = "top left";
  }
}
function ensureModeSwitch() {
  const old = document.getElementById("jt-home-switch");
  if (old) old.remove();
  if (document.getElementById("jt-mode-switch")) return;
  const a = document.createElement("a");
  a.id = "jt-mode-switch"; a.href = "./kids/"; a.textContent = "KIDS";
  document.body.appendChild(a);
}
async function boot() {
  try {
    const res = await fetch("./layout.json");
    if (res.ok) window.__jtLayout = await res.json();
  } catch (_) {}
  applyFullCabin(window.__jtLayout || {});
  ensureModeSwitch();
  const stage = document.querySelector(".cabin-stage");
  if (stage) {
    const obs = new MutationObserver(() => applyFullCabin({}));
    obs.observe(stage, { attributes: true, attributeFilter: ["style"] });
  }
  setInterval(() => applyFullCabin({}), 800);
}
if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
else boot();
