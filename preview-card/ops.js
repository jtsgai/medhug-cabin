// Preview-card adaptation of root tryon-cabin-ops.js (root file untouched).
// Keeps: status prompts, 15s End emphasis, ~20s unattended auto-stop, owner minutes.
// Differences: "live" = rail collapsed (try-on UI active), hint/reason live in the top band
// instead of over the video, and no extra dock End button (the rail has a real #btn-end).
(() => {
  const END_GLOW_MS = 15000;
  const ABSENT_STOP_MS = 20000;
  const $ = (id) => document.getElementById(id);
  const isEn = () => (localStorage.getItem("jt_lang") || "zh") === "en";

  // --- failure reason line (core calls window.__jtTryonReason via the loader patch) ---
  const reason = document.createElement("div");
  reason.id = "tryon-reason";
  reason.className = "tryon-reason hidden";
  document.body.appendChild(reason);
  let reasonTimer = 0;
  window.__jtTryonReason = (text) => {
    const clean = String(text || "").replace(/请看摄像头/g, "").trim();
    if (!clean) return;
    reason.textContent = clean;
    reason.classList.remove("hidden");
    clearTimeout(reasonTimer);
    reasonTimer = setTimeout(() => reason.classList.add("hidden"), 5000);
  };

  // --- hint (shown only before a try-on starts; never over the card) ---
  const hint = document.createElement("div");
  hint.id = "tryon-hint";
  hint.className = "tryon-hint";
  document.body.appendChild(hint);

  // --- owner minutes (same endpoint as live; failures are silent) ---
  const stats = document.createElement("div");
  stats.id = "owner-stats";
  stats.className = "owner-stats hidden";
  document.body.appendChild(stats);
  async function refreshOwner() {
    try {
      const r = await fetch("https://live.medhug.ai/api/cabin-owner", { credentials: "include" });
      if (!r.ok) return stats.classList.add("hidden");
      const d = await r.json();
      stats.textContent = `Used ${d.used_minutes ?? d.tryon_minutes ?? 0} min`;
      stats.classList.remove("hidden");
    } catch {
      stats.classList.add("hidden");
    }
  }
  if (new URLSearchParams(location.search).get("owner") !== "0") {
    refreshOwner();
    setInterval(refreshOwner, 20000);
  }

  // --- current garment name, mirrored from the core's "Live · <name>" status text ---
  // The core overwrites the name with a bare "Live" right after the first connect, so the active thumb
  // (+ catalog lookup) is the primary source and the status text is only a fallback.
  const statusEl = $("status");
  const nameEl = $("rail-current-name");
  const listEl = $("explore-list");
  let catalogItems = [];
  fetch("../catalog.json").then((r) => r.json()).then((c) => { catalogItems = c.items || []; syncName(); }).catch(() => {});
  function syncName() {
    if (!nameEl) return;
    let name = "";
    const img = listEl && listEl.querySelector(".explore-card.active img");
    if (img) {
      const file = decodeURIComponent((img.getAttribute("src") || "").split("/").pop());
      const item = catalogItems.find((it) => it.model === file || it.product === file);
      if (item) name = (isEn() ? item.name : item.name_cn) || item.name || "";
    }
    if (!name) {
      const txt = statusEl && !statusEl.classList.contains("hidden") ? statusEl.textContent : "";
      const i = txt.indexOf(" · ");
      if (i >= 0) name = txt.slice(i + 3);
    }
    nameEl.textContent = name || "—";
  }
  const nameObs = new MutationObserver(syncName);
  if (statusEl) nameObs.observe(statusEl, { childList: true, characterData: true, subtree: true, attributes: true, attributeFilter: ["class"] });
  if (listEl) nameObs.observe(listEl, { childList: true, subtree: true, attributes: true, attributeFilter: ["class"] });
  syncName();

  // --- live detection, End emphasis, unattended auto-stop ---
  const video = $("video-output");
  const panel = $("left-panel");
  const dock = $("jt-dock");
  const probe = document.createElement("canvas");
  const pctx = probe.getContext("2d", { willReadFrequently: true });
  let last = null;
  let absentSince = 0;
  let liveSince = 0;
  let detector = null;
  if (typeof FaceDetector !== "undefined") {
    try { detector = new FaceDetector({ fastMode: true, maxDetectedFaces: 1 }); } catch { detector = null; }
  }

  function isLive() {
    return Boolean(panel && panel.classList.contains("collapsed"));
  }

  setInterval(async () => {
    const live = isLive();
    const end = $("btn-end");
    hint.textContent = isEn() ? "Tap a look, then Try on" : "选一件衣服，再点「试穿」";
    hint.classList.toggle("hidden", live);
    dock?.classList.toggle("locked", live);
    document.body.classList.toggle("is-tryon-live", live);
    if (live && !liveSince) liveSince = Date.now();
    if (!live) liveSince = 0;
    end?.classList.toggle("glow", Boolean(liveSince && Date.now() - liveSince >= END_GLOW_MS));
    if (!live || !video?.videoWidth) { absentSince = 0; last = null; return; }
    if (!$("end-overlay")?.classList.contains("hidden")) { absentSince = 0; return; } // already ending
    let person = false;
    if (detector) {
      try {
        const faces = await detector.detect(video);
        person = Boolean(faces && faces.length);
      } catch { person = false; }
    }
    if (!person) {
      probe.width = 64;
      probe.height = 36;
      try {
        pctx.drawImage(video, 0, 0, 64, 36);
        const data = pctx.getImageData(0, 0, 64, 36).data;
        if (last) {
          let diff = 0;
          for (let i = 0; i < data.length; i += 16) diff += Math.abs(data[i] - last[i]);
          if (diff / (data.length / 16) > 8) person = true;
        }
        last = data;
      } catch { last = null; }
    }
    if (person) absentSince = 0;
    else if (!absentSince) absentSince = Date.now();
    else if (Date.now() - absentSince >= ABSENT_STOP_MS) {
      absentSince = 0;
      $("btn-end")?.click();
    }
  }, 500);
})();
