/**
 * Force try-on cabin aspect 136:208 and sync admin layout ranges.
 */
function clamp(n, lo, hi, fb) {
  const x = Number(n);
  return Number.isFinite(x) ? Math.min(hi, Math.max(lo, x)) : fb;
}

function applyCabin136(layout) {
  const stage = document.querySelector(".cabin-stage");
  if (!stage) return;
  const L = layout || window.__jtLayout || {};
  const w = clamp(L.cabin_max_width_px, 360, 720, 560);
  stage.style.setProperty("--cabin-w", w + "px");
  stage.style.width = `min(${w}px, 96vw)`;
  stage.style.height = `min(94vh, calc(min(${w}px, 96vw) * 208 / 136))`;
  stage.style.aspectRatio = "136 / 208";
  const cabin = document.querySelector(".cabin");
  if (cabin && L.left_column_percent != null) {
    const pct = clamp(L.left_column_percent, 28, 45, 34);
    cabin.style.gridTemplateColumns = `${pct}% 1fr`;
  }
  if (L.zone2_featured_max_px != null) {
    document.documentElement.style.setProperty(
      "--feat-max",
      clamp(L.zone2_featured_max_px, 100, 240, 150) + "px"
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
  applyCabin136(L);

  const stage = document.querySelector(".cabin-stage");
  if (stage) {
    const obs = new MutationObserver(() => applyCabin136(readLayout()));
    obs.observe(stage, { attributes: true, attributeFilter: ["style"] });
  }

  window.addEventListener("message", (ev) => {
    if (ev.data && ev.data.type === "jt-layout-live") {
      window.__jtLayout = { ...(window.__jtLayout || {}), ...(ev.data.layout || {}) };
      applyCabin136(window.__jtLayout);
    }
  });

  setInterval(() => applyCabin136(readLayout()), 800);
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", boot);
} else {
  boot();
}
