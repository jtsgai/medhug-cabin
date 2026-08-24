/**
 * JT Cabin UI v7 — customer-first
 * Camera always on · API only on try-on · shortlist re-try · i18n · catalog categories
 */
import { createDecartClient, models } from "https://esm.sh/@decartai/sdk";
import { DECART_API_KEY } from "./config.js";
import { t, getLang, setLang } from "./i18n.js";

const ASSETS_BASE = "./assets/";

let catalog = { categories: [], items: [], featured_ids: [] };
let layout = {};
let featuredIndex = 0;
let activeCategory = "tops";
let realtimeClient = null;
let localStream = null;
let currentGarmentId = null;
let pendingGarmentId = null;
let apiConnected = false;
let panelCollapsed = false;
let cameraEnabled = true;
let shortlist = new Set();
let triedOrder = [];
let holdTimer = null;
let endBoostTimer = null;
let mode = "attract";
let presenceSince = null;
let idleSince = Date.now();
let attractList = [];
let attractIdx = 0;
let exitList = [];
let exitIdx = 0;
let exitTimer = null;
let motionTimer = null;
let lastFrameData = null;

const $ = (s) => document.querySelector(s);

function toast(msg) {
  const el = $("#toast");
  el.textContent = msg;
  el.classList.remove("hidden");
  clearTimeout(toast._t);
  toast._t = setTimeout(() => el.classList.add("hidden"), 2200);
}
function showError(msg) {
  const el = $("#error-banner");
  el.textContent = msg;
  el.classList.add("show");
  console.error(msg);
}
function clearError() {
  $("#error-banner").classList.remove("show");
}
function showApiCreditHint(on) {
  const el = $("#api-credit-hint");
  if (!el) return;
  el.classList.toggle("hidden", !on);
  el.setAttribute("aria-hidden", on ? "false" : "true");
}
function enterTryOnUiPreview(garmentId) {
  if (garmentId) currentGarmentId = garmentId;
  if (cameraEnabled) showLocalPreview();
  else setCameraOffStage(true);
  collapsePanel();
  renderExplore();
}
function setStatusKey(key, on = false) {
  const el = $("#status");
  if (!el) return;
  const showKeys = new Set(["status_connecting","status_applying","status_live","status_ending"]);
  if (!showKeys.has(key)) {
    el.textContent = "";
    el.classList.add("hidden");
    el.classList.remove("on");
    return;
  }
  let text = t(key) || "";
  if (text === key) text = "";
  el.textContent = text;
  el.classList.toggle("on", on);
  el.classList.toggle("hidden", !text);
}
function getItem(id) {
  return catalog.items.find((g) => g.id === id);
}
function featuredList() {
  let ids = layout.featured_ids || catalog.featured_ids || [];
  if (typeof ids === "string") ids = ids.split(/[,，\s]+/).filter(Boolean);
  if (!Array.isArray(ids) || !ids.length) ids = catalog.featured_ids || [];
  return ids.map(getItem).filter(Boolean);
}
function logTried(id) {
  const last = triedOrder[triedOrder.length - 1];
  if (last && last.id === id) return;
  triedOrder.push({ id, at: Date.now() });
}
function holdMs() {
  return (layout.end_hold_seconds || 18) * 1000;
}
function applyI18n() {
  document.querySelectorAll("[data-i18n]").forEach((el) => {
    const k = el.getAttribute("data-i18n");
    el.textContent = t(k);
  });
  const langBtn = $("#btn-lang");
  if (langBtn) langBtn.textContent = t("lang");
}
async function urlToFile(url, filename) {
  const res = await fetch(url);
  if (!res.ok) throw new Error("Cannot load " + url);
  const blob = await res.blob();
  return new File([blob], filename, { type: blob.type || "image/png" });
}
async function startLocalCamera() {
  if (localStream) return localStream;
  try {
    localStream = await navigator.mediaDevices.getUserMedia({
      audio: false,
      video: { facingMode: "user", width: { ideal: 720 }, height: { ideal: 1280 } },
    });
    showLocalPreview();
    setStatusKey("status_camera");
    return localStream;
  } catch (err) {
    console.warn("[JT] camera", err);
    localStream = null;
    return null;
  }
}
function showLocalPreview() {
  const v = $("#video-output");
  if (localStream) {
    v.srcObject = localStream;
    $("#video-placeholder").classList.add("hidden");
  }
}
async function connectApiAndTry(garmentId) {
  clearError();
  try { if (!localStream) await startLocalCamera(); } catch (_) {}
  enterTryOnUiPreview(garmentId);
  $("#btn-save").classList.add("hidden");
  if (!DECART_API_KEY || DECART_API_KEY === "YOUR_API_KEY_HERE") {
    showApiCreditHint(true);
    setStatusKey("status_camera");
    return;
  }
  setStatusKey("status_connecting");
  const CONNECT_MS = 12000;
  try {
    if (!localStream) throw new Error("no camera stream");
    const connectWork = (async () => {
      const model = models.realtime("lucy-vton-3.5");
      const client = createDecartClient({ apiKey: DECART_API_KEY });
      const clientRt = await client.realtime.connect(localStream, {
        model,
        mirror: "auto",
        onRemoteStream: (editedStream) => {
          $("#video-output").srcObject = editedStream;
          $("#video-placeholder").classList.add("hidden");
          showApiCreditHint(false);
        },
      });
      realtimeClient = clientRt;
      apiConnected = true;
      boostEndLater();
      await applyGarment(garmentId);
    })();
    let timer;
    const timeout = new Promise((_, reject) => {
      timer = setTimeout(() => reject(new Error("API timeout credit or network")), CONNECT_MS);
    });
    await Promise.race([connectWork, timeout]);
    clearTimeout(timer);
    showApiCreditHint(false);
    setStatusKey("status_live", true);
  } catch (err) {
    console.warn("[JT] API connect failed", err);
    showApiCreditHint(true);
    setStatusKey("status_camera");
    apiConnected = false;
    if (realtimeClient) {
      try { realtimeClient.disconnect(); } catch (_) {}
      realtimeClient = null;
    }
    showLocalPreview();
  }
}
async function applyGarment(id) {
  const g = getItem(id);
  if (!g || !realtimeClient) return;
  currentGarmentId = id;
  renderExplore();
  setStatusKey("status_applying", true);
  try {
    let productFile = g.product;
    let prompt = g.prompt;
    if (g.multi_color && Array.isArray(g.variants) && g.variants.length) {
      const v = g.variants[g._activeVariant || 0];
      if (v) {
        productFile = v.product || productFile;
        prompt = v.prompt || prompt;
      }
    }
    const file = await urlToFile(ASSETS_BASE + productFile, productFile);
    await realtimeClient.set({ prompt, image: file, enhance: false });
    logTried(id);
    setStatusKey("status_live", true);
    {
      const nm = getLang() === "en" ? g.name : g.name_cn;
      const base = t("status_live");
      $("#status").textContent = nm ? base + " · " + nm : base;
      $("#status").classList.remove("hidden");
      $("#status").classList.add("on");
    }
  } catch (err) {
    console.warn("[JT] applyGarment", err);
    showApiCreditHint(true);
    clearError();
  }
}
function disconnectApi() {
  if (realtimeClient) {
    try { realtimeClient.disconnect(); } catch (_) {}
    realtimeClient = null;
  }
  apiConnected = false;
  currentGarmentId = null;
  showApiCreditHint(false);
  $("#btn-end").classList.add("hidden");
  $("#btn-save").classList.add("hidden");
  clearTimeout(endBoostTimer);
  restoreLocalCamera();
  setStatusKey("status_camera");
  renderExplore();
}
async function restoreLocalCamera() {
  try {
    if (!localStream || !localStream.active || localStream.getVideoTracks().every((tr) => tr.readyState !== "live")) {
      localStream = null;
      await startLocalCamera();
    } else {
      const v = $("#video-output");
      v.srcObject = localStream;
      v.muted = true;
      await v.play().catch(() => {});
      $("#video-placeholder").classList.add("hidden");
    }
  } catch (e) {
    localStream = null;
    await startLocalCamera();
  }
}
function collapsePanel() {
  panelCollapsed = true;
  $("#left-panel").classList.add("collapsed");
  $("#btn-return-dot")?.classList.remove("hidden");
  $("#btn-change")?.classList.add("hidden");
  $("#btn-end")?.classList.add("hidden");
  $("#zone-session-done")?.classList.add("hidden");
  $("#btn-end-link")?.classList.add("hidden");
  $("#btn-cam-toggle")?.classList.remove("hidden");
  $("#btn-expand-strip")?.classList.remove("hidden");
  $("#explore-list")?.classList.add("explore-list-collapsed");
  renderExplore();
  requestAnimationFrame(() => positionReturnDot());
}
function expandPanel() {
  if (typeof disconnectApi === "function") disconnectApi();
  panelCollapsed = false;
  $("#left-panel").classList.remove("collapsed");
  $("#btn-return-dot")?.classList.add("hidden");
  $("#btn-change")?.classList.add("hidden");
  $("#btn-end")?.classList.add("hidden");
  $("#zone-session-done")?.classList.add("hidden");
  $("#btn-end-link")?.classList.remove("hidden");
  $("#btn-cam-toggle")?.classList.remove("hidden");
  $("#btn-expand-strip")?.classList.add("hidden");
  const box = $("#explore-list");
  if (box) { box.className = "explore-list"; box.removeAttribute("style"); }
  renderCats();
  renderFeatured();
  renderExplore();
  renderShortlist();
  requestAnimationFrame(() => { scheduleExploreLayout(); requestAnimationFrame(() => scheduleExploreLayout()); });
  setTimeout(() => scheduleExploreLayout(), 100);
  setTimeout(() => scheduleExploreLayout(), 300);
}
function setCameraOffStage(on) {
  const stage = $("#camera-off-stage");
  const video = $("#video-output");
  if (stage) {
    stage.classList.toggle("hidden", !on);
    stage.setAttribute("aria-hidden", on ? "false" : "true");
  }
  if (video) video.classList.toggle("cam-off", on);
  $("#btn-cam-toggle")?.classList.toggle("is-off", on);
}
async function toggleCamera() {
  if (cameraEnabled) {
    cameraEnabled = false;
    if (localStream) {
      localStream.getTracks().forEach((tr) => tr.stop());
      localStream = null;
    }
    const v = $("#video-output");
    if (v) v.srcObject = null;
    if (realtimeClient) {
      try { realtimeClient.disconnect(); } catch (_) {}
      realtimeClient = null;
      apiConnected = false;
    }
    setCameraOffStage(true);
  } else {
    cameraEnabled = true;
    setCameraOffStage(false);
    await startLocalCamera();
    showLocalPreview();
  }
}
function boostEndLater() {
  clearTimeout(endBoostTimer);
  const btn = $("#btn-end");
  if (btn) {
    btn.classList.remove("boost");
    endBoostTimer = setTimeout(() => btn.classList.add("boost"), 15000);
  }
}
async function loadData() {
  try {
    const saved = localStorage.getItem("jt_layout_deployed");
    if (saved) layout = JSON.parse(saved);
    else {
      const res = await fetch("./layout.json");
      layout = await res.json();
    }
  } catch (_) { layout = {}; }
  const res = await fetch("./catalog.json");
  catalog = await res.json();
  if (layout.default_lang) setLang(layout.default_lang);
  if (layout.show_featured === false) $("#zone-featured").style.display = "none";
  if (layout.show_shortlist === false) $("#zone-shortlist").style.display = "none";
  applyLayoutVars();
  applyI18n();
  renderCats();
  renderFeatured();
  renderExplore();
  renderShortlist();
}
function sanitizeLayout(L) {
  const s = { ...(L || {}) };
  const clamp = (v, lo, hi, d) => {
    const n = Number(v);
    if (!Number.isFinite(n)) return d;
    return Math.min(hi, Math.max(lo, n));
  };
  s.cabin_max_width_px = clamp(s.cabin_max_width_px, 400, 640, 560);
  s.left_column_percent = clamp(s.left_column_percent, 32, 38, 34);
  s.zone2_featured_max_px = clamp(s.zone2_featured_max_px, 120, 180, 150);
  s.zone_empty_percent = clamp(s.zone_empty_percent, 0, 12, 4);
  if (Array.isArray(s.featured_ids)) s.featured_ids = s.featured_ids.map(String);
  delete s.zone3_px; delete s.zone4_px; delete s.zone1_px; delete s.cabin_height_px;
  return s;
}
function applyLayoutVars() {
  layout = sanitizeLayout(layout || {});
  const stage = document.querySelector(".cabin-stage") || document.querySelector(".cabin");
  const cabin = document.querySelector(".cabin");
  if (!stage) return;
  const w = layout.cabin_max_width_px;
  stage.style.width = `min(${w}px, 96vw)`;
  stage.style.height = `min(94vh, calc(min(${w}px, 96vw) * 16 / 9))`;
  if (cabin) cabin.style.gridTemplateColumns = `${layout.left_column_percent}% 1fr`;
  document.documentElement.style.setProperty("--feat-max", layout.zone2_featured_max_px + "px");
  const featImg = document.querySelector("#featured-slot img");
  if (featImg) {
    featImg.style.maxHeight = layout.zone2_featured_max_px + "px";
    featImg.style.objectFit = "contain";
  }
  document.querySelectorAll(".shortlist-item img").forEach((img) => { img.style.objectFit = "contain"; });
  [".zone-2", ".zone-3", ".zone-4", ".zone-1"].forEach((sel) => {
    const el = document.querySelector(sel);
    if (!el) return;
    el.style.height = ""; el.style.minHeight = ""; el.style.maxHeight = ""; el.style.flex = "";
  });
  const z2 = document.querySelector(".zone-2"); if (z2) z2.style.flex = "0 0 auto";
  const z3 = document.querySelector(".zone-3"); if (z3) { z3.style.flex = "1 1 auto"; z3.style.minHeight = "0"; }
  const z4 = document.querySelector(".zone-4"); if (z4) z4.style.flex = "0 0 auto";
  const empty = document.querySelector(".zone-empty"); if (empty) empty.style.flex = `0 0 ${layout.zone_empty_percent}%`;
}
function renderCats() {
  const box = $("#cat-tabs");
  if (!box) return;
  box.innerHTML = "";
  const cats = catalog.categories || [];
  const hasItems = (cid) => catalog.items.some((i) => i.category === cid);
  if (!cats.some((c) => c.id === activeCategory) || !hasItems(activeCategory)) {
    const first = cats.find((c) => hasItems(c.id));
    if (first) activeCategory = first.id;
  }
  box.style.display = "grid";
  cats.forEach((c) => {
    const ok = hasItems(c.id);
    const b = document.createElement("button");
    b.type = "button";
    b.className = "cat-tab" + (c.id === activeCategory ? " active" : "") + (ok ? "" : " disabled");
    b.textContent = getLang() === "en" ? c.name_en : c.name_zh;
    b.disabled = !ok;
    if (ok) b.onclick = () => { activeCategory = c.id; renderCats(); renderExplore(); };
    box.appendChild(b);
  });
}
function renderFeatured() {
  const list = featuredList();
  if (!list.length) return;
  featuredIndex = ((featuredIndex % list.length) + list.length) % list.length;
  const g = list[featuredIndex];
  const slot = $("#featured-slot");
  if (!slot) return;
  let dots = "";
  if (g.multi_color && Array.isArray(g.variants) && g.variants.length > 1) {
    dots = `<div class="card-swatches">` + g.variants.map((v) => `<span class="swatch" style="background:${v.hex || v.color || "#888"}"></span>`).join("") + `</div>`;
  }
  slot.innerHTML = `<img src="${ASSETS_BASE}${g.model}" alt="" />${dots}`;
  slot.onclick = () => openProductPreview(g.id, false);
}
function renderExplore() {
  const box = $("#explore-list");
  if (!box) return;
  box.innerHTML = "";
  const items = catalog.items.filter((g) => g.category === activeCategory);
  if (panelCollapsed) {
    box.classList.add("explore-list-collapsed");
    items.forEach((g) => {
      const card = document.createElement("div");
      card.className = "explore-card" + (g.id === currentGarmentId ? " active" : "");
      card.innerHTML = `<img src="${ASSETS_BASE}${g.model || g.product}" alt="" loading="lazy" />`;
      card.onclick = () => {
        pendingGarmentId = g.id;
        if (realtimeClient) applyGarment(g.id);
        else connectApiAndTry(g.id);
      };
      box.appendChild(card);
    });
    return;
  }
  box.classList.remove("explore-list-collapsed");
  const pageSize = 4;
  const pages = [];
  for (let i = 0; i < items.length; i += pageSize) pages.push(items.slice(i, i + pageSize));
  if (!pages.length) { scheduleExploreLayout(); return; }
  pages.forEach((pageItems) => {
    const page = document.createElement("div");
    page.className = "explore-page";
    pageItems.forEach((g) => {
      const card = document.createElement("div");
      card.className = "explore-card" + (g.id === currentGarmentId ? " active" : "");
      let swatchesHtml = "";
      if (g.multi_color && Array.isArray(g.variants) && g.variants.length > 1) {
        swatchesHtml = `<div class="card-swatches">` + g.variants.slice(0, 4).map((v) => `<span class="swatch" style="background:${v.hex || v.color || "#888"}"></span>`).join("") + `</div>`;
      }
      card.innerHTML = `<img src="${ASSETS_BASE}${g.model}" alt="" loading="lazy" />${swatchesHtml}`;
      card.onclick = () => openProductPreview(g.id, false);
      page.appendChild(card);
    });
    for (let k = pageItems.length; k < pageSize; k++) {
      const ph = document.createElement("div");
      ph.className = "explore-card placeholder";
      ph.setAttribute("aria-hidden", "true");
      page.appendChild(ph);
    }
    box.appendChild(page);
  });
  box.scrollTop = 0;
  scheduleExploreLayout();
}
function positionReturnDot() {
  const dot = $("#btn-return-dot");
  const panel = $("#left-panel");
  if (!dot || !panel || !panelCollapsed) return;
  const r = panel.getBoundingClientRect();
  const stage = document.querySelector(".cabin-stage") || document.querySelector(".cabin");
  const sr = stage ? stage.getBoundingClientRect() : { left: 0, top: 0 };
  dot.style.position = "absolute";
  dot.style.left = Math.round(r.right - sr.left + 6) + "px";
  dot.style.top = Math.round(r.top - sr.top + r.height / 2 - 11) + "px";
}
function sizeExplorePages() {
  const box = $("#explore-list");
  if (!box || panelCollapsed) return;
  const wrap = box.closest(".explore-wrap");
  if (!wrap) return;
  void wrap.offsetHeight;
  const availW = Math.floor(wrap.clientWidth || box.clientWidth || 0);
  const availH = Math.floor(wrap.clientHeight || box.clientHeight || 0);
  if (availW < 48 || availH < 48) return;
  const gap = 8, pad = 4;
  const innerW = Math.max(40, availW - pad * 2);
  const innerH = Math.max(40, availH - pad * 2);
  let cellW = (innerW - gap) / 2;
  let cellH = cellW * (4 / 3);
  if (cellH * 2 + gap > innerH) {
    cellH = (innerH - gap) / 2;
    cellW = cellH * (3 / 4);
  }
  cellW = Math.floor(cellW);
  cellH = Math.floor(cellH);
  if (cellW < 24 || cellH < 32) return;
  const pageH = cellH * 2 + gap + pad * 2;
  box.querySelectorAll(".explore-page").forEach((pg) => {
    pg.style.boxSizing = "border-box";
    pg.style.width = "100%";
    pg.style.height = pageH + "px";
    pg.style.minHeight = pageH + "px";
    pg.style.maxHeight = pageH + "px";
    pg.style.display = "grid";
    pg.style.gridTemplateColumns = cellW + "px " + cellW + "px";
    pg.style.gridTemplateRows = cellH + "px " + cellH + "px";
    pg.style.gap = gap + "px";
    pg.style.padding = pad + "px";
    pg.style.margin = "0";
    pg.style.overflow = "hidden";
    pg.style.justifyContent = "center";
    pg.style.alignContent = "center";
    pg.style.scrollSnapAlign = "start";
    pg.style.scrollSnapStop = "always";
    pg.querySelectorAll(".explore-card").forEach((card) => {
      card.style.boxSizing = "border-box";
      card.style.width = cellW + "px";
      card.style.height = cellH + "px";
      card.style.maxWidth = cellW + "px";
      card.style.maxHeight = cellH + "px";
      card.style.margin = "0";
      card.style.padding = "0";
      card.style.background = "transparent";
      card.style.border = "none";
      card.style.boxShadow = "none";
      card.style.borderRadius = "0";
      card.style.overflow = "hidden";
      card.style.display = "flex";
      card.style.alignItems = "center";
      card.style.justifyContent = "center";
      const img = card.querySelector("img");
      if (img) {
        img.style.width = "100%";
        img.style.height = "100%";
        img.style.objectFit = "contain";
        img.style.objectPosition = "center center";
        img.style.display = "block";
        img.style.borderRadius = "10px";
        img.style.border = "1px solid rgba(255,255,255,0.12)";
        img.style.background = "#161616";
      }
    });
  });
}
function scheduleExploreLayout() {
  const run = () => {
    sizeExplorePages();
    updateExploreScrollHint();
    if (panelCollapsed) positionReturnDot();
  };
  run();
  requestAnimationFrame(() => { run(); requestAnimationFrame(run); });
  setTimeout(run, 50);
  setTimeout(run, 150);
  setTimeout(run, 400);
  document.querySelectorAll("#explore-list img").forEach((img) => {
    if (!img.complete) img.addEventListener("load", run, { once: true });
  });
  const box = $("#explore-list");
  if (box && !box._ro && typeof ResizeObserver !== "undefined") {
    box._ro = new ResizeObserver(() => run());
    box._ro.observe(box);
    const wrap = box.closest(".explore-wrap");
    if (wrap) box._ro.observe(wrap);
  }
}
function updateExploreScrollHint() {
  const box = $("#explore-list");
  const hint = $("#explore-scroll-hint");
  if (!box || !hint) return;
  sizeExplorePages();
  const pages = box.querySelectorAll(".explore-page");
  if (pages.length <= 1) { hint.classList.add("hidden"); return; }
  const last = pages[pages.length - 1];
  const boxRect = box.getBoundingClientRect();
  const lastRect = last.getBoundingClientRect();
  hint.classList.toggle("hidden", lastRect.bottom <= boxRect.bottom + 16);
  if (!box._scrollBound) {
    box._scrollBound = true;
    box.addEventListener("scroll", () => {
      sizeExplorePages();
      const pages2 = box.querySelectorAll(".explore-page");
      if (pages2.length <= 1) { hint.classList.add("hidden"); return; }
      const last2 = pages2[pages2.length - 1];
      const br = box.getBoundingClientRect();
      const lr = last2.getBoundingClientRect();
      hint.classList.toggle("hidden", lr.bottom <= br.bottom + 16);
    }, { passive: true });
  }
}
function renderShortlist() {
  const box = $("#shortlist");
  if (!box) return;
  box.innerHTML = "";
  const cnt = $("#shortlist-count");
  if (cnt) cnt.textContent = String(shortlist.size);
  shortlist.forEach((id) => {
    const g = getItem(id);
    if (!g) return;
    const el = document.createElement("div");
    el.className = "shortlist-item";
    el.innerHTML = `<img src="${ASSETS_BASE}${g.model}" alt="" /><button class="remove" type="button">×</button>`;
    el.onclick = (e) => {
      if (e.target.classList.contains("remove")) { shortlist.delete(id); renderShortlist(); return; }
      openProductPreview(id, true);
    };
    box.appendChild(el);
  });
  scheduleExploreLayout();
}
function openProductPreview(id) {
  const g = getItem(id);
  if (!g) return;
  pendingGarmentId = id;
  const variants = g.multi_color && Array.isArray(g.variants) ? g.variants : null;
  let active = g._activeVariant || 0;
  if (variants && variants[active]) $("#product-modal-img").src = ASSETS_BASE + (variants[active].product || g.product);
  else $("#product-modal-img").src = ASSETS_BASE + g.product;
  $("#product-modal-name").textContent = (getLang() === "en" ? g.name : g.name_cn) || "";
  const sw = $("#modal-swatches");
  if (sw) {
    sw.innerHTML = "";
    if (variants && variants.length > 1) {
      variants.forEach((v, i) => {
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "modal-swatch" + (i === active ? " active" : "");
        btn.style.background = v.hex || v.color || "#888";
        btn.onclick = (e) => { e.stopPropagation(); g._activeVariant = i; openProductPreview(id); };
        sw.appendChild(btn);
      });
    }
  }
  const slBtn = $("#btn-modal-shortlist");
  if (slBtn) slBtn.textContent = shortlist.has(id) ? t("in_shortlist") : t("add_shortlist");
  $("#btn-modal-try").textContent = t("try_on");
  $("#btn-modal-cancel").textContent = t("back");
  $("#product-modal").classList.remove("hidden");
}
function closeProductPreview() {
  $("#product-modal").classList.add("hidden");
  pendingGarmentId = null;
}
function toggleShortlistId(id) {
  if (!id) return;
  if (shortlist.has(id)) shortlist.delete(id);
  else shortlist.add(id);
  renderShortlist();
  toast(t("toast_added"));
  const slBtn = $("#btn-modal-shortlist");
  if (slBtn) slBtn.textContent = shortlist.has(id) ? t("in_shortlist") : t("add_shortlist");
}
async function confirmTryOn() {
  const id = pendingGarmentId;
  closeProductPreview();
  if (!id) return;
  try {
    if (apiConnected && currentGarmentId === id) { collapsePanel(); return; }
    if (apiConnected) {
      try { await applyGarment(id); } catch (e) { showApiCreditHint(true); }
      collapsePanel();
      return;
    }
    await connectApiAndTry(id);
  } catch (e) {
    enterTryOnUiPreview(id);
    showApiCreditHint(true);
  }
}
function buildEndList(container, ids, clickable) {
  container.innerHTML = "";
  [...new Set(ids)].forEach((id) => {
    const g = getItem(id);
    if (!g) return;
    const el = document.createElement("div");
    el.className = "end-item end-item-product";
    const name = getLang() === "en" ? g.name : g.name_cn;
    const saved = shortlist.has(id);
    el.innerHTML = `<img src="${ASSETS_BASE}${g.product}" alt="" /><span>${name}</span><button type="button" class="end-sl-btn" data-id="${id}">${saved ? t("in_shortlist") : t("add_shortlist")}</button>`;
    el.querySelector(".end-sl-btn").onclick = (e) => {
      e.stopPropagation();
      toggleShortlistId(id);
      e.currentTarget.textContent = shortlist.has(id) ? t("in_shortlist") : t("add_shortlist");
    };
    if (clickable) {
      el.querySelector("img").onclick = () => {
        $("#end-overlay").classList.add("hidden");
        clearHoldTimer();
        openProductPreview(id);
      };
    }
    container.appendChild(el);
  });
}
function showEndOverlay() {
  buildEndList($("#end-tried"), triedOrder.map((x) => x.id), false);
  const sl = [...shortlist];
  if (sl.length) {
    $("#end-shortlist-wrap").classList.remove("hidden");
    buildEndList($("#end-shortlist"), sl, true);
  } else $("#end-shortlist-wrap").classList.add("hidden");
  applyI18n();
  $("#end-overlay").classList.remove("hidden");
}
function clearHoldTimer() {
  if (holdTimer) { clearTimeout(holdTimer); holdTimer = null; }
}
function endSession() {
  if (!apiConnected && triedOrder.length === 0) { toast(t("toast_no_session")); return; }
  showEndOverlay();
  setStatusKey("status_ending");
  try {
    const log = { at: new Date().toISOString(), tried: triedOrder.map((x) => x.id), shortlist: [...shortlist] };
    const prev = JSON.parse(localStorage.getItem("jt_tryon_logs") || "[]");
    prev.push(log);
    localStorage.setItem("jt_tryon_logs", JSON.stringify(prev.slice(-50)));
  } catch (_) {}
  clearHoldTimer();
  holdTimer = setTimeout(() => {
    disconnectApi();
    expandPanel();
    triedOrder = [];
    mode = "interactive";
    restoreLocalCamera();
  }, holdMs());
}
function closeEndOverlay() {
  $("#end-overlay").classList.add("hidden");
  clearHoldTimer();
  disconnectApi();
  expandPanel();
  triedOrder = [];
  mode = "interactive";
  restoreLocalCamera();
}
function attractDwellMs() { return (layout.attract_dwell_seconds || 5) * 1000; }
function attractIdleMs() { return (layout.attract_idle_seconds || 45) * 1000; }
function exitSlideMs() { return (layout.exit_carousel_seconds || 4) * 1000; }
async function loadAttractVideos() {
  attractList = [];
  try {
    const res = await fetch("./attract/playlist.json");
    if (res.ok) {
      const data = await res.json();
      attractList = (data?.videos || []).map((v) => {
        const name = String(v).trim();
        if (!name) return null;
        if (name.startsWith("http")) return name;
        return "./attract/" + name.replace(/^\.\/attract\//, "").replace(/^\.\//, "");
      }).filter(Boolean);
    }
  } catch (e) { console.warn("playlist", e); }
}
function showAttract() {
  if (layout.attract_enabled === false) return;
  mode = "attract";
  const layer = $("#attract-layer");
  if (!layer) return;
  layer.classList.remove("hidden");
  const vid = $("#attract-video");
  if (attractList.length && vid) {
    attractIdx = attractIdx % attractList.length;
    vid.src = attractList[attractIdx];
    vid.play().catch(() => {});
    vid.onended = () => {
      attractIdx = (attractIdx + 1) % attractList.length;
      vid.src = attractList[attractIdx];
      vid.play().catch(() => {});
    };
  }
  if (apiConnected) disconnectApi();
  expandPanel();
}
function hideAttract() {
  $("#attract-layer")?.classList.add("hidden");
  try { $("#attract-video")?.pause(); } catch (_) {}
}
function enterInteractive(reason) {
  if (mode === "interactive") return;
  mode = "interactive";
  hideAttract();
  presenceSince = null;
  idleSince = Date.now();
  restoreLocalCamera();
  touchActivity();
}
function touchActivity() {
  idleSince = Date.now();
  if (mode === "attract") enterInteractive("tap");
}
function startPresenceWatch() {
  clearInterval(motionTimer);
  const video = $("#video-output");
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  let movingHits = 0;
  motionTimer = setInterval(() => {
    if (!localStream || !video?.videoWidth) return;
    if (mode === "interactive" && !apiConnected) {
      if (Date.now() - idleSince > attractIdleMs()) { showAttract(); return; }
    }
    if (mode !== "attract") return;
    if (layout.attract_auto_enter === false) return;
    canvas.width = 80; canvas.height = 45;
    try {
      ctx.drawImage(video, 0, 0, 80, 45);
      const frame = ctx.getImageData(0, 0, 80, 45).data;
      if (lastFrameData) {
        let diff = 0;
        for (let i = 0; i < frame.length; i += 4) diff += Math.abs(frame[i] - lastFrameData[i]);
        const score = diff / (frame.length / 4);
        movingHits = score > 6 ? Math.min(movingHits + 1, 20) : Math.max(movingHits - 2, 0);
        if (movingHits >= 3) {
          if (!presenceSince) presenceSince = Date.now();
          else if (Date.now() - presenceSince >= attractDwellMs()) {
            enterInteractive("presence");
            presenceSince = null;
            movingHits = 0;
          }
        } else presenceSince = null;
      }
      lastFrameData = frame;
    } catch (_) {}
  }, 400);
}
function init() {
  loadData()
    .then(() => loadAttractVideos())
    .then(() => { if (layout.attract_enabled !== false) showAttract(); })
    .catch((e) => showError(e.message));
  startLocalCamera().then(() => startPresenceWatch());
  $("#attract-layer")?.addEventListener("click", () => enterInteractive("tap"));
  document.querySelector(".cabin-stage")?.addEventListener("pointerdown", () => {
    if (mode === "interactive") touchActivity();
  });
  $("#btn-end") && ($("#btn-end").onclick = endSession);
  $("#btn-session-done") && ($("#btn-session-done").onclick = endSession);
  $("#btn-change") && ($("#btn-change").onclick = expandPanel);
  $("#btn-cam-toggle") && ($("#btn-cam-toggle").onclick = () => toggleCamera());
  $("#btn-end-link") && ($("#btn-end-link").onclick = endSession);
  const leftPanel = $("#left-panel");
  if (leftPanel && !leftPanel._expandBound) {
    leftPanel._expandBound = true;
    $("#btn-expand-strip")?.addEventListener("click", (e) => { e.preventDefault(); e.stopPropagation(); expandPanel(); });
    leftPanel.addEventListener("click", (e) => {
      if (!panelCollapsed) return;
      if (e.target.closest(".explore-card")) return;
      expandPanel();
    });
  }
  $("#btn-save") && ($("#btn-save").onclick = () => { if (currentGarmentId) toggleShortlistId(currentGarmentId); });
  $("#btn-feat-prev") && ($("#btn-feat-prev").onclick = (e) => { e.stopPropagation(); featuredIndex -= 1; renderFeatured(); });
  $("#btn-feat-next") && ($("#btn-feat-next").onclick = (e) => { e.stopPropagation(); featuredIndex += 1; renderFeatured(); });
  $("#btn-modal-cancel") && ($("#btn-modal-cancel").onclick = closeProductPreview);
  $("#btn-modal-try") && ($("#btn-modal-try").onclick = confirmTryOn);
  $("#btn-modal-shortlist") && ($("#btn-modal-shortlist").onclick = () => toggleShortlistId(pendingGarmentId));
  $("#btn-end-close") && ($("#btn-end-close").onclick = closeEndOverlay);
  $("#btn-lang") && ($("#btn-lang").onclick = () => {
    setLang(getLang() === "zh" ? "en" : "zh");
    applyI18n(); renderCats(); renderFeatured(); renderExplore(); renderShortlist(); applyLayoutVars();
    scheduleExploreLayout();
  });
  $("#btn-return-dot") && ($("#btn-return-dot").onclick = (e) => { e.preventDefault(); e.stopPropagation(); expandPanel(); });
}
init();
window.addEventListener("resize", () => scheduleExploreLayout());
window.addEventListener("message", (ev) => {
  if (!ev.data || ev.data.type !== "jt-layout-live") return;
  try {
    layout = sanitizeLayout(ev.data.layout || {});
    localStorage.setItem("jt_layout_deployed", JSON.stringify(layout));
    if (layout.default_lang) setLang(layout.default_lang);
    applyLayoutVars(); applyI18n(); renderCats(); renderFeatured(); renderExplore();
  } catch (e) { console.warn("live layout", e); }
});
