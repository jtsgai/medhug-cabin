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
let mode = "attract"; // attract | interactive | exit
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

function isCreditOrQuotaError(err) {
  const m = String((err && err.message) || err || "").toLowerCase();
  return /credit|balance|payment|billing|quota|insufficient|402|payment required|limit|余额|费用|额度|欠费|top.?up|prepaid/.test(m);
}

function showApiCreditHint(on) {
  const el = $("#api-credit-hint");
  if (!el) return;
  el.classList.toggle("hidden", !on);
  el.setAttribute("aria-hidden", on ? "false" : "true");
}

/** API 失败时仍进入试衣 UI（本地摄像头），便于验收侧栏与布局 */
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
  // 仅试穿流程相关状态显示；就绪/摄像不显示
  const showKeys = new Set([
    "status_connecting",
    "status_applying",
    "status_live",
    "status_ending",
  ]);
  if (!showKeys.has(key)) {
    el.textContent = "";
    el.classList.add("hidden");
    el.classList.remove("on");
    return;
  }
  let text = t(key) || "";
  if (text === key) text = ""; // 防止出现 status... 原文
  el.textContent = text;
  el.classList.toggle("on", on);
  el.classList.toggle("hidden", !text);
}
function getItem(id) {
  return catalog.items.find((g) => g.id === id);
}
/** 卡片短名：避免英文中间断行 */
function displayName(g, short = true) {
  if (!g) return "";
  const en = g.name || "";
  const zh = g.name_cn || "";
  const full = getLang() === "en" ? en : zh;
  if (!short) return full;
  // 优先用空格分段取前两词（英文）
  if (getLang() === "en") {
    const parts = en.split(/\s+/).filter(Boolean);
    if (parts.length >= 2) return parts.slice(0, 2).join(" ");
    return en.length > 14 ? en.slice(0, 13) + "…" : en;
  }
  // 中文超过 6 字截断
  return zh.length > 6 ? zh.slice(0, 6) + "…" : zh;
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
  // 1) 先进入试衣 UI（本地摄像头 + 收栏），保证无额度也能验收页面
  try {
    if (!localStream) await startLocalCamera();
  } catch (_) {}
  enterTryOnUiPreview(garmentId);
  $("#btn-save").classList.add("hidden");

  if (!DECART_API_KEY || DECART_API_KEY === "YOUR_API_KEY_HERE") {
    showApiCreditHint(true);
    setStatusKey("status_camera");
    return;
  }

  // 2) 后台尝试 API；超时或失败不退出试衣页
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
      timer = setTimeout(
        () => reject(new Error("API timeout credit or network")),
        CONNECT_MS
      );
    });
    await Promise.race([connectWork, timeout]);
    clearTimeout(timer);
    showApiCreditHint(false);
    setStatusKey("status_live", true);
  } catch (err) {
    console.warn("[JT] API connect failed", err);
    clearTimeout(typeof timer !== "undefined" ? timer : 0);
    // 保持试衣 UI；金色脉冲点提示额度/连接问题
    showApiCreditHint(true);
    setStatusKey("status_camera");
    apiConnected = false;
    if (realtimeClient) {
      try {
        realtimeClient.disconnect();
      } catch (_) {}
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
    const msg = String((err && err.message) || err || "");
    console.warn("[JT] applyGarment", msg);
    // 重连/额度类：不弹红字，保持试衣 UI + 金色提示点
    if (/reconnect|credit|quota|balance|timeout|network|failed to fetch/i.test(msg)) {
      showApiCreditHint(true);
      clearError();
    } else {
      showApiCreditHint(true);
      clearError();
    }
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
  // 必须恢复本地摄像头画面
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
    console.warn("restore camera", e);
    localStream = null;
    await startLocalCamera();
  }
}

function collapsePanel() {
  panelCollapsed = true;
  const panel = $("#left-panel");
  panel.classList.add("collapsed");
  (function(el){ if(el) el.classList.remove("hidden"); })($("#btn-return-dot"));
  ($("#btn-change")||{classList:{add(){},remove(){}}}).classList.add("hidden");
  (function(el){ if(el) el.classList.add("hidden"); })($("#btn-end"));
  (function(el){ if(el) el.classList.add("hidden"); })($("#zone-session-done"));
  (function(el){ if(el) el.classList.add("hidden"); })($("#btn-end-link"));
  (function(el){ if(el) el.classList.remove("hidden"); })($("#btn-cam-toggle"));
  (function(el){ if(el) el.classList.remove("hidden"); })($("#btn-expand-strip"));
  const box = $("#explore-list");
  if (box) {
    box.classList.add("explore-list-collapsed");
  }
  renderExplore();
  requestAnimationFrame(() => positionReturnDot());
  setTimeout(() => positionReturnDot(), 50);
}
function expandPanel() {
  // 退出试衣视图：立即断开 API（选衣区不连 API）
  if (typeof disconnectApi === "function") disconnectApi();
  panelCollapsed = false;
  const panel = $("#left-panel");
  panel.classList.remove("collapsed");
  (function(el){ if(el) el.classList.add("hidden"); })($("#btn-return-dot"));
  ($("#btn-change")||{classList:{add(){},remove(){}}}).classList.add("hidden");
  (function(el){ if(el) el.classList.add("hidden"); })($("#btn-end"));
  (function(el){ if(el) el.classList.add("hidden"); })($("#zone-session-done"));
  (function(el){ if(el) el.classList.remove("hidden"); })($("#btn-end-link"));
  (function(el){ if(el) el.classList.remove("hidden"); })($("#btn-cam-toggle"));
  (function(el){ if(el) el.classList.add("hidden"); })($("#btn-expand-strip"));
  const box = $("#explore-list");
  if (box) {
    box.className = "explore-list";
    box.removeAttribute("style");
  }
  renderCats();
  renderFeatured();
  renderExplore();
  renderShortlist();
  requestAnimationFrame(() => {
    scheduleExploreLayout();
    requestAnimationFrame(() => scheduleExploreLayout());
  });
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
  const btn = $("#btn-cam-toggle");
  if (btn) btn.classList.toggle("is-off", on);
}

async function toggleCamera() {
  if (cameraEnabled) {
    // 关闭：停轨，画面改为品牌玻璃静帧
    cameraEnabled = false;
    if (localStream) {
      localStream.getTracks().forEach((tr) => tr.stop());
      localStream = null;
    }
    const v = $("#video-output");
    if (v) v.srcObject = null;
    // 若 API 连着，断开以免空流报错
    if (realtimeClient) {
      try {
        realtimeClient.disconnect();
      } catch (_) {}
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
  btn.classList.remove("boost");
  endBoostTimer = setTimeout(() => btn.classList.add("boost"), 15000);
}

async function loadData() {
  // layout: admin localStorage overrides file
  try {
    const saved = localStorage.getItem("jt_layout_deployed");
    if (saved) layout = JSON.parse(saved);
    else {
      const res = await fetch("./layout.json");
      layout = await res.json();
    }
  } catch (_) {
    layout = {};
  }
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

/** 安全布局：只保留「会真正作用到顾客页」的参数 */
function sanitizeLayout(L) {
  const s = { ...(L || {}) };
  const clamp = (v, lo, hi, d) => {
    const n = Number(v);
    if (!Number.isFinite(n)) return d;
    return Math.min(hi, Math.max(lo, n));
  };
  // ✅ 会生效
  // 画幅仅允许微调（全息舱真机将用 100% 视口）
  s.cabin_max_width_px = clamp(s.cabin_max_width_px, 400, 440, 420);
  s.left_column_percent = clamp(s.left_column_percent, 32, 38, 34);
  s.zone2_featured_max_px = clamp(s.zone2_featured_max_px, 120, 180, 150);
  s.zone_empty_percent = clamp(s.zone_empty_percent, 0, 12, 4);
  if (Array.isArray(s.featured_ids)) {
    s.featured_ids = s.featured_ids.map(String);
  }
  // 开关类原样保留
  // ❌ 固定分区高度会搞乱排版，丢弃
  delete s.zone3_px;
  delete s.zone4_px;
  delete s.zone1_px;
  delete s.cabin_height_px;
  return s;
}

function applyLayoutVars() {
  layout = sanitizeLayout(layout || {});
  // 若仍异常：控制台执行 localStorage.removeItem("jt_layout_deployed"); location.reload();
  const stage = document.querySelector(".cabin-stage") || document.querySelector(".cabin");
  const cabin = document.querySelector(".cabin");
  if (!stage) return;
  const w = layout.cabin_max_width_px;
  stage.style.width = `min(${w}px, 92vw)`;
  stage.style.height = `min(92vh, calc(min(${w}px, 92vw) * 16 / 9))`;
  if (cabin) {
    cabin.style.gridTemplateColumns = `${layout.left_column_percent}% 1fr`;
  }
  document.documentElement.style.setProperty("--feat-max", layout.zone2_featured_max_px + "px");
  const featImg = document.querySelector("#featured-slot img");
  if (featImg) {
    featImg.style.maxHeight = layout.zone2_featured_max_px + "px";
    featImg.style.objectFit = "contain";
  }
  document.querySelectorAll(".shortlist-item img").forEach((img) => {
    img.style.objectFit = "contain";
  });

  // 清除可能被旧配置写死的高度，恢复 flex 流式布局
  [".zone-2", ".zone-3", ".zone-4", ".zone-1"].forEach((sel) => {
    const el = document.querySelector(sel);
    if (!el) return;
    el.style.height = "";
    el.style.minHeight = "";
    el.style.maxHeight = "";
    el.style.flex = "";
  });
  const z2 = document.querySelector(".zone-2");
  if (z2) {
    z2.style.flex = "0 0 auto";
  }
  const z3 = document.querySelector(".zone-3");
  if (z3) {
    z3.style.flex = "1 1 auto";
    z3.style.minHeight = "0";
  }
  const z4 = document.querySelector(".zone-4");
  if (z4) {
    z4.style.flex = "0 0 auto";
  }
  const empty = document.querySelector(".zone-empty");
  if (empty) {
    empty.style.flex = `0 0 ${layout.zone_empty_percent}%`;
  }
}

function renderCats() {
  const box = $("#cat-tabs");
  box.innerHTML = "";
  const cats = catalog.categories || [];
  // 固定四类 2×2，无货灰显仍占位
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
    b.className =
      "cat-tab" +
      (c.id === activeCategory ? " active" : "") +
      (ok ? "" : " disabled");
    b.textContent = getLang() === "en" ? c.name_en : c.name_zh;
    b.disabled = !ok;
    if (ok) {
      b.onclick = () => {
        activeCategory = c.id;
        renderCats();
        renderExplore();
      };
    }
    box.appendChild(b);
  });
}

function renderFeatured() {
  const list = featuredList();
  if (!list.length) return;
  featuredIndex = ((featuredIndex % list.length) + list.length) % list.length;
  const g = list[featuredIndex];
  const slot = $("#featured-slot");
  // 主推区无文字，仅图；多色点在角上
  let dots = "";
  if (g.multi_color && Array.isArray(g.variants) && g.variants.length > 1) {
    dots =
      `<div class="card-swatches">` +
      g.variants
        .map((v) => `<span class="swatch" style="background:${v.hex || v.color || "#888"}"></span>`)
        .join("") +
      `</div>`;
  }
  slot.innerHTML = `<img src="${ASSETS_BASE}${g.model}" alt="" />${dots}`;
  slot.onclick = () => openProductPreview(g.id, false);
}

function renderExplore() {
  const box = $("#explore-list");
  if (!box) return;
  box.innerHTML = "";

  const items = catalog.items.filter((g) => g.category === activeCategory);

  // —— 试衣收栏：纯竖向缩略图，不用 2×2 分页 ——
  if (panelCollapsed) {
    box.classList.add("explore-list-collapsed");
    items.forEach((g) => {
      const card = document.createElement("div");
      card.className = "explore-card" + (g.id === currentGarmentId ? " active" : "");
      const src = ASSETS_BASE + (g.model || g.product);
      card.innerHTML = `<img src="${src}" alt="" loading="lazy" />`;
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

  // —— 正常选衣：整页 2×2 ——
  const pageSize = 4;
  const pages = [];
  for (let i = 0; i < items.length; i += pageSize) {
    pages.push(items.slice(i, i + pageSize));
  }
  if (!pages.length) {
    scheduleExploreLayout();
    return;
  }
  pages.forEach((pageItems) => {
    const page = document.createElement("div");
    page.className = "explore-page";
    pageItems.forEach((g) => {
      const card = document.createElement("div");
      card.className = "explore-card" + (g.id === currentGarmentId ? " active" : "");
      let swatchesHtml = "";
      if (g.multi_color && Array.isArray(g.variants) && g.variants.length > 1) {
        swatchesHtml =
          `<div class="card-swatches">` +
          g.variants
            .slice(0, 4)
            .map((v) => {
              const hex = v.hex || v.color || "#888";
              return `<span class="swatch" style="background:${hex}"></span>`;
            })
            .join("") +
          `</div>`;
      }
      card.innerHTML = `
        <img src="${ASSETS_BASE}${g.model}" alt="" loading="lazy" />
        ${swatchesHtml}`;
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
  // 贴在侧条右侧中部
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

  const gap = 8;
  const pad = 4;
  const innerW = Math.max(40, availW - pad * 2);
  const innerH = Math.max(40, availH - pad * 2);

  // 以宽度推 3:4 格高；若两行装不下则按高度反推，保证四张同屏完整
  let cellW = (innerW - gap) / 2;
  let cellH = cellW * (4 / 3);
  const needH = cellH * 2 + gap;
  if (needH > innerH) {
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
        img.style.boxShadow = "none";
      }
    });
  });
}

/** 首屏布局未完成时多次回量，避免旧版大空框 */
function scheduleExploreLayout() {
  const run = () => {
    sizeExplorePages();
    updateExploreScrollHint();
    if (panelCollapsed) positionReturnDot();
  };
  run();
  requestAnimationFrame(() => {
    run();
    requestAnimationFrame(run);
  });
  setTimeout(run, 50);
  setTimeout(run, 150);
  setTimeout(run, 400);
  // 图片加载后高度可能变化
  document.querySelectorAll("#explore-list img").forEach((img) => {
    if (img.complete) return;
    img.addEventListener("load", run, { once: true });
  });
  // 容器尺寸变化
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
  if (pages.length <= 1) {
    hint.classList.add("hidden");
    return;
  }
  const last = pages[pages.length - 1];
  const boxRect = box.getBoundingClientRect();
  const lastRect = last.getBoundingClientRect();
  const atBottom = lastRect.bottom <= boxRect.bottom + 16;
  hint.classList.toggle("hidden", atBottom);
  if (!box._scrollBound) {
    box._scrollBound = true;
    box.addEventListener(
      "scroll",
      () => {
        sizeExplorePages();
        updateExploreScrollHint._tick = requestAnimationFrame(() => {
          const pages2 = box.querySelectorAll(".explore-page");
          if (pages2.length <= 1) {
            hint.classList.add("hidden");
            return;
          }
          const last2 = pages2[pages2.length - 1];
          const br = box.getBoundingClientRect();
          const lr = last2.getBoundingClientRect();
          hint.classList.toggle("hidden", lr.bottom <= br.bottom + 16);
        });
      },
      { passive: true }
    );
  }
}

function renderShortlist() {
  const box = $("#shortlist");
  box.innerHTML = "";
  $("#shortlist-count").textContent = String(shortlist.size);
  shortlist.forEach((id) => {
    const g = getItem(id);
    if (!g) return;
    const el = document.createElement("div");
    el.className = "shortlist-item";
    el.title = t("retry_from_shortlist");
    el.innerHTML = `<img src="${ASSETS_BASE}${g.model}" alt="" /><button class="remove" type="button">×</button>`;
    el.onclick = (e) => {
      if (e.target.classList.contains("remove")) {
        shortlist.delete(id);
        renderShortlist();
        return;
      }
      // 备选再试：直接进入产品确认或试穿
      openProductPreview(id, true);
    };
    box.appendChild(el);
  });

  if (typeof scheduleExploreLayout === "function") scheduleExploreLayout();
}

/** fromShortlist: 允许在收窄时从备选再试 */
function openProductPreview(id, fromShortlist) {
  const g = getItem(id);
  if (!g) return;
  pendingGarmentId = id;
  // 当前展示色：若有 variants，用 activeVariant 或第一个
  const variants = g.multi_color && Array.isArray(g.variants) ? g.variants : null;
  let active = g._activeVariant || 0;
  if (variants && variants[active]) {
    $("#product-modal-img").src = ASSETS_BASE + (variants[active].product || g.product);
  } else {
    $("#product-modal-img").src = ASSETS_BASE + g.product;
  }
  // 名称：当前语言单一名称，不中英混排
  const name = getLang() === "en" ? g.name : g.name_cn;
  $("#product-modal-name").textContent = name || "";

  const sw = $("#modal-swatches");
  if (sw) {
    sw.innerHTML = "";
    if (variants && variants.length > 1) {
      variants.forEach((v, i) => {
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "modal-swatch" + (i === active ? " active" : "");
        btn.style.background = v.hex || v.color || "#888";
        btn.title = getLang() === "en" ? (v.name_en || v.name || "") : (v.name_zh || v.name || "");
        btn.onclick = (e) => {
          e.stopPropagation();
          g._activeVariant = i;
          openProductPreview(id, fromShortlist);
        };
        sw.appendChild(btn);
      });
    }
  }

  const slBtn = $("#btn-modal-shortlist");
  slBtn.textContent = shortlist.has(id) ? t("in_shortlist") : t("add_shortlist");
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
    if (apiConnected && currentGarmentId === id) {
      collapsePanel();
      return;
    }
    if (apiConnected) {
      try {
        await applyGarment(id);
      } catch (e) {
        console.warn("[JT] apply failed", e);
        showApiCreditHint(true);
      }
      collapsePanel();
      return;
    }
    await connectApiAndTry(id);
  } catch (e) {
    console.warn("[JT] confirmTryOn", e);
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
    el.innerHTML = `
      <img src="${ASSETS_BASE}${g.product}" alt="" />
      <span>${name}</span>
      <button type="button" class="end-sl-btn" data-id="${id}">${saved ? t("in_shortlist") : t("add_shortlist")}</button>
    `;
    el.querySelector(".end-sl-btn").onclick = (e) => {
      e.stopPropagation();
      toggleShortlistId(id);
      e.currentTarget.textContent = shortlist.has(id) ? t("in_shortlist") : t("add_shortlist");
    };
    if (clickable) {
      el.style.cursor = "pointer";
      el.querySelector("img").onclick = () => {
        $("#end-overlay").classList.add("hidden");
        clearHoldTimer();
        openProductPreview(id, true);
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
  } else {
    $("#end-shortlist-wrap").classList.add("hidden");
  }
  applyI18n();
  $("#end-overlay").classList.remove("hidden");
}

function clearHoldTimer() {
  if (holdTimer) {
    clearTimeout(holdTimer);
    holdTimer = null;
  }
}

function endSession() {
  if (!apiConnected && triedOrder.length === 0) {
    toast(t("toast_no_session"));
    return;
  }
  showEndOverlay();
  setStatusKey("status_ending");
  try {
    const log = {
      at: new Date().toISOString(),
      tried: triedOrder.map((x) => x.id),
      shortlist: [...shortlist],
    };
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
    // 无操作一段时间后再回吸引态（由 presence watch 的 idle 处理）
  }, holdMs());
}

function closeEndOverlay() {
  $("#end-overlay").classList.add("hidden");
  clearHoldTimer();
  disconnectApi();
  expandPanel();
  triedOrder = [];
  // 不再弹出离场轮播页，直接回主 UI + 摄像头
  mode = "interactive";
  restoreLocalCamera();
}



/** ---------- Attract / presence / exit carousel ---------- */
function attractDwellMs() {
  return (layout.attract_dwell_seconds || 5) * 1000;
}
function attractIdleMs() {
  return (layout.attract_idle_seconds || 45) * 1000;
}
function exitSlideMs() {
  return (layout.exit_carousel_seconds || 4) * 1000;
}

async function loadAttractVideos() {
  attractList = [];
  try {
    const res = await fetch("./attract/playlist.json");
    if (res.ok) {
      const text = await res.text();
      let data;
      try {
        data = JSON.parse(text);
      } catch (_) {
        // 容错：文件名忘加引号时，尝试提取
        const m = text.match(/videos\s*:\s*\[\s*([^\]]+)\s*\]/);
        if (m) {
          data = {
            videos: m[1].split(/[,，]/).map((s) =>
              s.trim().replace(/^["']|["']$/g, "")
            ).filter(Boolean),
          };
        }
      }
      attractList = (data?.videos || []).map((v) => {
        const name = String(v).trim().replace(/^["']|["']$/g, "");
        if (!name) return null;
        if (name.startsWith("http")) return name;
        return "./attract/" + name.replace(/^\.\/attract\//, "").replace(/^\.\//, "");
      }).filter(Boolean);
    }
  } catch (e) {
    console.warn("playlist", e);
  }
  console.log("attract videos:", attractList);
}

function showAttract() {
  if (layout.attract_enabled === false) return;
  mode = "attract";
  const layer = $("#attract-layer");
  layer.classList.remove("hidden");
  if (layout.attract_fullscreen) layer.classList.add("fullscreen");
  else layer.classList.remove("fullscreen");
  const vid = $("#attract-video");
  const hint = document.querySelector(".attract-hint");
  if (attractList.length) {
    attractIdx = attractIdx % attractList.length;
    vid.src = attractList[attractIdx];
    vid.onerror = () => {
      if (hint) hint.textContent = "未找到视频文件，请放入 attract 文件夹 · 轻触进入";
    };
    vid.play().catch(() => {
      if (hint) hint.textContent = "点击屏幕开始播放并进入 · Tap to start";
    });
    vid.onended = () => {
      attractIdx = (attractIdx + 1) % attractList.length;
      vid.src = attractList[attractIdx];
      vid.play().catch(() => {});
    };
  } else {
    vid.removeAttribute("src");
    if (hint) hint.textContent = "请将视频放入 attract/ 并写入 playlist.json · 轻触进入";
  }
  // 吸引态可关 API
  if (apiConnected) disconnectApi();
  expandPanel();
}

function hideAttract() {
  const layer = $("#attract-layer");
  layer.classList.add("hidden");
  const vid = $("#attract-video");
  try { vid.pause(); } catch (_) {}
}

function enterInteractive(reason) {
  if (mode === "interactive") return;
  mode = "interactive";
  hideAttract();
  stopExitCarousel();
  presenceSince = null;
  idleSince = Date.now();
  restoreLocalCamera();
  touchActivity();
  console.log("enter interactive:", reason);
}

function touchActivity() {
  idleSince = Date.now();
  if (mode === "attract") enterInteractive("tap");
}

function startExitCarousel(ids) {
  const unique = [...new Set(ids)].map(getItem).filter(Boolean);
  if (!unique.length) {
    showAttract();
    return;
  }
  mode = "exit";
  exitList = unique;
  exitIdx = 0;
  hideAttract();
  $("#exit-carousel").classList.remove("hidden");
  paintExitSlide();
  clearInterval(exitTimer);
  exitTimer = setInterval(() => {
    exitIdx = (exitIdx + 1) % exitList.length;
    paintExitSlide();
  }, exitSlideMs());
  // 一段时间后回吸引态
  clearTimeout(startExitCarousel._to);
  startExitCarousel._to = setTimeout(() => {
    stopExitCarousel();
    showAttract();
  }, Math.max(exitSlideMs() * exitList.length * 2, 20000));
}

function paintExitSlide() {
  const g = exitList[exitIdx];
  if (!g) return;
  $("#exit-carousel-img").src = ASSETS_BASE + (g.model || g.product);
  $("#exit-carousel-caption").textContent =
    (getLang() === "en" ? g.name : g.name_cn) || "";
}

function stopExitCarousel() {
  clearInterval(exitTimer);
  exitTimer = null;
  $("#exit-carousel").classList.add("hidden");
}

/** 简易运动检测：有人靠近约 dwell 秒可自动进互动（可关） */
function startPresenceWatch() {
  clearInterval(motionTimer);
  const video = $("#video-output");
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  let movingHits = 0;
  motionTimer = setInterval(() => {
    if (!localStream || !video.videoWidth) return;

    if (mode === "interactive" && !apiConnected) {
      if (Date.now() - idleSince > attractIdleMs()) {
        showAttract();
        return;
      }
    }
    if (mode !== "attract") return;
    if (layout.attract_auto_enter === false) return;

    canvas.width = 80;
    canvas.height = 45;
    try {
      ctx.drawImage(video, 0, 0, 80, 45);
      const frame = ctx.getImageData(0, 0, 80, 45).data;
      if (lastFrameData) {
        let diff = 0;
        for (let i = 0; i < frame.length; i += 4) {
          diff += Math.abs(frame[i] - lastFrameData[i]);
        }
        const score = diff / (frame.length / 4);
        // 更灵敏：连续多帧有运动才累计停留时间
        if (score > 6) {
          movingHits = Math.min(movingHits + 1, 20);
        } else {
          movingHits = Math.max(movingHits - 2, 0);
        }
        if (movingHits >= 3) {
          if (!presenceSince) presenceSince = Date.now();
          else if (Date.now() - presenceSince >= attractDwellMs()) {
            enterInteractive("presence");
            presenceSince = null;
            movingHits = 0;
          }
        } else {
          presenceSince = null;
        }
      }
      lastFrameData = frame;
    } catch (_) {}
  }, 400);
}

function init() {
  loadData()
    .then(() => loadAttractVideos())
    .then(() => {
      if (layout.attract_enabled !== false) showAttract();
    })
    .catch((e) => showError(e.message));
  startLocalCamera().then(() => startPresenceWatch());

  $("#attract-layer").onclick = () => enterInteractive("tap");
  $("#exit-carousel").onclick = () => {
    stopExitCarousel();
    enterInteractive("tap-exit");
  };
  document.querySelector(".cabin-stage")?.addEventListener("pointerdown", () => {
    if (mode === "interactive") touchActivity();
  });

  $("#btn-end").onclick = endSession;
  const sessionDone = $("#btn-session-done");
  if (sessionDone) sessionDone.onclick = endSession;
  $("#btn-change").onclick = expandPanel;
  const camToggle = $("#btn-cam-toggle");
  if (camToggle) camToggle.onclick = () => toggleCamera();
  const endLink = $("#btn-end-link");
  if (endLink) endLink.onclick = endSession;
  // 试衣侧条：点击条本身展开选衣（避免突兀「换衣」按钮）
  const leftPanel = $("#left-panel");
  if (leftPanel && !leftPanel._expandBound) {
    leftPanel._expandBound = true;
    const expandStripBtn = document.getElementById("btn-expand-strip");
    if (expandStripBtn) {
      expandStripBtn.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        expandPanel();
      });
    }
    leftPanel.addEventListener("click", (e) => {
      if (!panelCollapsed) return;
      // 点在缩略图上已由 card 处理换装，不触发展开
      if (e.target.closest(".explore-card")) return;
      expandPanel();
    });
  }
  $("#btn-save").onclick = () => {
    if (currentGarmentId) toggleShortlistId(currentGarmentId);
  };
  $("#btn-feat-prev").onclick = (e) => {
    e.stopPropagation();
    featuredIndex -= 1;
    renderFeatured();
  };
  $("#btn-feat-next").onclick = (e) => {
    e.stopPropagation();
    featuredIndex += 1;
    renderFeatured();
  };
  $("#btn-modal-cancel").onclick = closeProductPreview;
  $("#btn-modal-try").onclick = confirmTryOn;
  $("#btn-modal-shortlist").onclick = () => toggleShortlistId(pendingGarmentId);
  $("#btn-end-close").onclick = closeEndOverlay;
  $("#btn-lang").onclick = () => {
    setLang(getLang() === "zh" ? "en" : "zh");
    applyI18n();
    renderCats();
    renderFeatured();
    renderExplore();
    renderShortlist();
    applyLayoutVars();
    // 语言切换后文案高度变化，必须重算 2×2 页高
    scheduleExploreLayout();
    setTimeout(() => scheduleExploreLayout(), 100);
    setTimeout(() => scheduleExploreLayout(), 280);
    if (panelCollapsed) positionReturnDot();
  };

  const returnDot = $("#btn-return-dot");
  if (returnDot) {
    returnDot.onclick = (e) => {
      e.preventDefault();
      e.stopPropagation();
      expandPanel();
    };
  }
}


init();
window.addEventListener("resize", () => scheduleExploreLayout());

// 管理页实时推送
window.addEventListener("message", (ev) => {
  if (!ev.data || ev.data.type !== "jt-layout-live") return;
  try {
    layout = sanitizeLayout(ev.data.layout || {});
    localStorage.setItem("jt_layout_deployed", JSON.stringify(layout));
    if (layout.default_lang) setLang(layout.default_lang);
    if (layout.show_featured === false) $("#zone-featured").style.display = "none";
    else $("#zone-featured").style.display = "";
    if (layout.show_shortlist === false) $("#zone-shortlist").style.display = "none";
    else $("#zone-shortlist").style.display = "";
    applyLayoutVars();
    applyI18n();
    renderCats();
    renderFeatured();
    renderExplore();
  } catch (e) {
    console.warn("live layout", e);
  }
});
