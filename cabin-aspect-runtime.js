function clamp(n, lo, hi, fb) {
  const x = Number(n);
  return Number.isFinite(x) ? Math.min(hi, Math.max(lo, x)) : fb;
}

function applyFullCabin(layout) {
  const stage = document.querySelector(".cabin-stage");
  if (!stage) return;
  const L = layout || window.__jtLayout || {};

  stage.style.position = "fixed";
  stage.style.inset = "0";
  stage.style.width = "100vw";
  stage.style.height = "100vh";
  stage.style.maxWidth = "none";
  stage.style.maxHeight = "none";
  stage.style.aspectRatio = "auto";
  stage.style.margin = "0";
  stage.style.border = "0";
  stage.style.borderRadius = "0";
  stage.style.boxShadow = "none";
  stage.style.background = "#000";

  document.documentElement.style.background = "#000";
  document.body.style.background = "#000";

  const cabin = document.querySelector(".cabin");
  if (cabin) {
    cabin.style.width = "100%";
    cabin.style.height = "100%";
    cabin.style.background = "#000";
    if (L.left_column_percent != null) {
      const pct = clamp(L.left_column_percent, 22, 42, 30);
      cabin.style.gridTemplateColumns = `${pct}% 1fr`;
    }
  }
  if (L.zone2_featured_max_px != null) {
    document.documentElement.style.setProperty(
      "--feat-max",
      clamp(L.zone2_featured_max_px, 100, 320, 180) + "px"
    );
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
  const L = { ...(window.__jtLayout || {}), ...readLayout() };
  window.__jtLayout = L;
  applyFullCabin(L);

  const stage = document.querySelector(".cabin-stage");
  if (stage) {
    const obs = new MutationObserver(() => applyFullCabin(readLayout()));
    obs.observe(stage, { attributes: true, attributeFilter: ["style"] });
  }

  window.addEventListener("message", (ev) => {
    if (ev.data && ev.data.type === "jt-layout-live") {
      window.__jtLayout = { ...(window.__jtLayout || {}), ...(ev.data.layout || {}) };
      applyFullCabin(window.__jtLayout);
    }
  });

  setInterval(() => applyFullCabin(readLayout()), 800);
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", boot);
} else {
  boot();
}
