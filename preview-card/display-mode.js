// Display mode (清晰 1× / 标准 2× / 全屏对照) + OBS preset toggle UI.
// CSS-only: this file never calls getUserMedia / captureStream / Decart and never touches the 720x1280 stream.
(function () {
  const root = document.documentElement;
  const MODES = { "1": { scale: 1 }, "2": { scale: 2 }, full: { scale: 1 } };
  const DEFAULT_MODE = "2";

  function applyDpr() {
    const dpr = window.devicePixelRatio || 1.5;
    root.style.setProperty("--cabin-dpr", String(dpr));
    root.setAttribute("data-dpr", String(dpr));
    return dpr;
  }
  applyDpr();
  window.addEventListener("resize", applyDpr);

  let current = null;

  function setMode(mode) {
    if (!MODES[mode]) mode = DEFAULT_MODE;
    current = mode;
    root.style.setProperty("--tryon-scale", String(MODES[mode].scale));
    root.setAttribute("data-display-mode", mode);
    root.classList.toggle("is-fullscreen-compare", mode === "full");
    document.body && document.body.classList.toggle("is-fullscreen-compare", mode === "full");
    document.querySelectorAll("[data-mode-btn]").forEach((btn) => {
      const active = btn.getAttribute("data-mode-btn") === mode;
      btn.setAttribute("aria-pressed", active ? "true" : "false");
      btn.classList.toggle("is-active", active);
    });
    window.dispatchEvent(new CustomEvent("jt-display-mode", { detail: { mode } }));
  }

  const q = new URLSearchParams(location.search).get("mode");
  // Set before first paint so there is no layout jump.
  root.style.setProperty("--tryon-scale", "2");
  root.setAttribute("data-display-mode", DEFAULT_MODE);
  if (q && MODES[q]) { root.style.setProperty("--tryon-scale", String(MODES[q].scale)); root.setAttribute("data-display-mode", q); }

  function renderPreset(detail) {
    const badge = document.getElementById("obs-preset-status");
    const toggle = document.getElementById("obs-preset-toggle");
    if (!badge) return;
    const d = detail || window.__jtVtonStatus;
    if (!d) return;
    const tw = d.trackWidth || (d.camSettings && d.camSettings.width) || 0;
    const th = d.trackHeight || (d.camSettings && d.camSettings.height) || 0;
    const trackLabel = tw && th ? `track ${tw}×${th}` : "";
    badge.textContent = [d.label || "", trackLabel].filter(Boolean).join(" · ");
    badge.setAttribute("data-state", d.reason);
    const sub = document.getElementById("obs-preset-detail");
    if (sub) {
      const src = d.videoWidth && d.videoHeight ? `源 ${d.videoWidth}×${d.videoHeight}` : "源 —";
      const dev = d.fromObsDevice ? "OBS 设备" : "非 OBS 设备";
      const bits = [trackLabel || null, src, dev, `${d.fps || 20}fps`].filter(Boolean);
      sub.textContent = bits.join(" · ");
    }
    if (toggle) {
      toggle.setAttribute("aria-checked", d.obsPresetEnabled ? "true" : "false");
      toggle.classList.toggle("is-on", Boolean(d.obsPresetEnabled));
    }
  }
  window.addEventListener("jt-vton-status", (e) => renderPreset(e.detail));

  document.addEventListener("DOMContentLoaded", () => {
    setMode(q && MODES[q] ? q : DEFAULT_MODE);
    document.querySelectorAll("[data-mode-btn]").forEach((btn) => {
      btn.addEventListener("click", () => setMode(btn.getAttribute("data-mode-btn")));
    });
    const toggle = document.getElementById("obs-preset-toggle");
    if (toggle) {
      toggle.addEventListener("click", () => {
        const next = toggle.getAttribute("aria-checked") !== "true";
        if (window.__jtVton) window.__jtVton.setObsPreset(next);
        else renderPreset({ obsPresetEnabled: next, reason: next ? "no-video" : "preset-off", label: next ? "等待画面" : "预设已关闭", fps: 20 });
      });
    }
    renderPreset(window.__jtVtonStatus);
  });

  window.__jtDisplayMode = { setMode, getMode: () => current };
})();
