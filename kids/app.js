import { createDecartClient, models } from "https://esm.sh/@decartai/sdk";
import { DECART_API_KEY } from "./config.js";
import { STR } from "./i18n.js";

const $ = (s) => document.querySelector(s);

let characters = [];
let selectedId = null;
let localStream = null;
let realtimeClient = null;
let sessionActive = false;
let switching = false;

let presenceTimer = null;
let absenceSince = null;
const ABSENCE_EXIT_MS = 5000;
let presenceRunning = false;

// 默认英文
let lang = localStorage.getItem("kids_l1_lang") || "en";
if (lang !== "en" && lang !== "zh") lang = "en";

function t(key) {
  return (STR[lang] && STR[lang][key]) || (STR.en[key] || key);
}

function toast(msg) {
  const el = $("#toast");
  el.textContent = msg;
  el.classList.remove("hidden");
  clearTimeout(toast._t);
  toast._t = setTimeout(() => el.classList.add("hidden"), 3200);
}

function setStatus(text, show = true) {
  const el = $("#status");
  if (!el) return;
  el.textContent = text || "";
  el.classList.toggle("hidden", !show || !text);
}

function getChar(id) {
  return characters.find((c) => c.id === id);
}

function applyI18n() {
  document.documentElement.lang = lang === "zh" ? "zh-CN" : "en";
  const hl = $("#headline");
  if (hl) hl.textContent = t("headline");
  const btnLang = $("#btn-lang");
  if (btnLang) btnLang.textContent = t("lang");
  const btnStop = $("#btn-stop");
  if (btnStop) btnStop.textContent = t("exit");
  updateLogoState();
}

function speakWelcome(ch) {
  try {
    window.speechSynthesis.cancel();
    const text =
      lang === "zh"
        ? ch.welcome_zh || ch.welcome_en
        : ch.welcome_en || ch.welcome_zh || `Hi, I'm ${ch.name}`;
    const u = new SpeechSynthesisUtterance(text || `Hi, I'm ${ch.name}`);
    u.lang = lang === "zh" ? "zh-CN" : "en-US";
    u.rate = 0.95;
    window.speechSynthesis.speak(u);
  } catch (e) {
    console.warn("tts", e);
  }
}

function showEmpty(show) {
  $("#empty-state")?.classList.toggle("hidden", !show);
}

function applyLayoutFromStorage() {
  try {
    const raw = localStorage.getItem("kids_l1_layout_v1");
    if (!raw) return;
    const s = JSON.parse(raw);
    const root = document.querySelector(".cabin");
    if (!root) return;
    const map = {
      "--topbar-h": (s.topbar_height ?? 64) + "px",
      "--side-w": (s.side_width ?? 112) + "px",
      "--char-img": (s.char_img ?? 74) + "px",
      "--logo-pct": (s.logo_3d_pct ?? 52) + "%",
      "--gap": (s.gap ?? 4) + "px",
      "--pad": (s.padding ?? 8) + "px",
      "--logo-text-h": (s.logo_text_h ?? 32) + "px",
      "--headline-size": (s.headline_size ?? 16) + "px",
      "--topbar-oy": (s.topbar_offset_y ?? 0) + "px",
      "--char-gap": (s.char_gap ?? 6) + "px",
    };
    for (const [k, v] of Object.entries(map)) root.style.setProperty(k, v);
  } catch (e) {
    console.warn("layout apply", e);
  }
}

function updateLogoState() {
  const btn = $("#btn-logo-start");
  if (!btn) return;
  const ready = !!selectedId && !sessionActive;
  // 未开始前可点 Logo 的条件：已选角色
  btn.disabled = !ready;
  // 心跳：空状态时始终跳动（CSS .pulse-always）；选中后再加强 .pulse
  btn.classList.toggle("pulse", !sessionActive);
  const logoImg = btn.querySelector(".logo-3d");
  if (logoImg) logoImg.classList.add("pulse-always");
  const tip = $("#empty-text");
  if (tip) {
    if (sessionActive) tip.textContent = "";
    else if (selectedId) tip.textContent = t("clickLogo");
    else tip.textContent = t("pickFriend");
  }
}

function makeCard(c) {
  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = "char-card" + (c.id === selectedId ? " active" : "");
  btn.innerHTML = `
    <div class="char-name">${c.name_zh || c.name}</div>
    <img src="./assets/${c.display || c.ref}" alt="${c.name}" loading="lazy" />
  `;
  btn.onclick = () => onSelectCharacter(c.id);
  return btn;
}

function renderChars() {
  const left = $("#col-left");
  const right = $("#col-right");
  if (!left || !right) return;
  left.innerHTML = "";
  right.innerHTML = "";
  const list = characters.slice(0, 16);
  const mid = Math.ceil(list.length / 2);
  list.slice(0, mid).forEach((c) => left.appendChild(makeCard(c)));
  list.slice(mid).forEach((c) => right.appendChild(makeCard(c)));
}

async function onSelectCharacter(id) {
  if (id === selectedId && sessionActive) return;
  selectedId = id;
  renderChars();
  updateLogoState();
  if (sessionActive && realtimeClient) {
    await switchCharacterLive(id);
  }
}

async function switchCharacterLive(id) {
  const ch = getChar(id);
  if (!ch || !realtimeClient || switching) return;
  switching = true;
  setStatus(`${t("switchTo")} ${ch.name_zh || ch.name}…`);
  try {
    const file = await urlToFile("./assets/" + ch.ref, ch.ref);
    await realtimeClient.set({ prompt: ch.prompt, image: file, enhance: true });
    setStatus(
      lang === "zh"
        ? `和 ${ch.name_zh || ch.name} ${t("performingWith")}`
        : `${t("performingWith")} ${ch.name}`
    );
    speakWelcome(ch);
  } catch (e) {
    console.warn(e);
    toast(`${t("switchFail")}: ${errText(e).slice(0, 40)}`);
  } finally {
    switching = false;
  }
}

async function detectPersonInFrame(videoEl) {
  if (!videoEl || videoEl.readyState < 2) return true;
  try {
    if (window.FaceDetector) {
      const fd =
        detectPersonInFrame._fd ||
        (detectPersonInFrame._fd = new FaceDetector({ fastMode: true, maxDetectedFaces: 1 }));
      const faces = await fd.detect(videoEl);
      if (faces && faces.length > 0) return true;
    }
  } catch (_) {}

  try {
    const w = 64,
      h = 36;
    const canvas = detectPersonInFrame._c || (detectPersonInFrame._c = document.createElement("canvas"));
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    ctx.drawImage(videoEl, 0, 0, w, h);
    const data = ctx.getImageData(0, 0, w, h).data;
    let sum = 0;
    let diff = 0;
    const prev = detectPersonInFrame._prev;
    const gray = new Uint8Array(w * h);
    for (let i = 0, p = 0; i < data.length; i += 4, p++) {
      const g = (data[i] * 0.3 + data[i + 1] * 0.59 + data[i + 2] * 0.11) | 0;
      gray[p] = g;
      sum += g;
      if (prev) diff += Math.abs(g - prev[p]);
    }
    detectPersonInFrame._prev = gray;
    const mean = sum / (w * h);
    const motion = prev ? diff / (w * h) : 99;
    if (motion < 3.2 && mean < 16) return false;
    if (motion > 5.5) return true;
    return mean > 20;
  } catch (_) {
    return true;
  }
}

function stopPresenceWatch() {
  presenceRunning = false;
  if (presenceTimer) {
    clearInterval(presenceTimer);
    presenceTimer = null;
  }
  absenceSince = null;
}

function startPresenceWatch() {
  stopPresenceWatch();
  presenceRunning = true;
  absenceSince = null;
  const video = $("#video-output");
  presenceTimer = setInterval(async () => {
    if (!sessionActive || !presenceRunning) return;
    let present = true;
    try {
      present = await detectPersonInFrame(video);
    } catch (_) {
      present = true;
    }
    const now = Date.now();
    if (present) {
      absenceSince = null;
      return;
    }
    if (absenceSince == null) absenceSince = now;
    const gone = now - absenceSince;
    if (gone >= ABSENCE_EXIT_MS) {
      stopPresenceWatch();
      await stopTransform(false);
      toast(t("autoEnd"));
    } else {
      const left = Math.ceil((ABSENCE_EXIT_MS - gone) / 1000);
      setStatus(`${t("autoEndStatus")} ${left}s`);
    }
  }, 400);
}

async function startCamera() {
  if (localStream) {
    const tracks = localStream.getVideoTracks?.() || [];
    if (localStream.active && tracks.some((tr) => tr.readyState === "live")) {
      $("#video-output").srcObject = localStream;
      showEmpty(false);
      return localStream;
    }
    try {
      localStream.getTracks().forEach((tr) => tr.stop());
    } catch (_) {}
    localStream = null;
  }
  localStream = await navigator.mediaDevices.getUserMedia({
    audio: false,
    video: {
      facingMode: "user",
      width: { ideal: 720 },
      height: { ideal: 1280 },
      frameRate: { ideal: 30 },
    },
  });
  const v = $("#video-output");
  v.srcObject = localStream;
  v.muted = true;
  await v.play().catch(() => {});
  showEmpty(false);
  return localStream;
}

async function urlToFile(path, name) {
  const res = await fetch(path);
  if (!res.ok) throw new Error("Cannot load " + path);
  const blob = await res.blob();
  return new File([blob], name, { type: blob.type || "image/png" });
}

function errText(e) {
  if (!e) return "Unknown error";
  if (typeof e === "string") return e;
  return e.message || e.code || String(e);
}

async function startTransform() {
  const ch = getChar(selectedId);
  if (!ch) return toast(t("pickFriend"));
  if (sessionActive) return;

  if (!DECART_API_KEY || DECART_API_KEY === "YOUR_API_KEY_HERE") {
    toast(t("missingKey"));
    setStatus(t("missingKey"));
    return;
  }

  const logoBtn = $("#btn-logo-start");
  if (logoBtn) logoBtn.disabled = true;

  setStatus(t("connecting"));
  try {
    await startCamera();
  } catch (e) {
    console.warn(e);
    toast(`${t("startFailCam")}: ${errText(e).slice(0, 40)}`);
    showEmpty(true);
    updateLogoState();
    return;
  }

  setStatus(t("connecting"));
  let timeoutId;
  try {
    const model = models.realtime("lucy-latest");
    const client = createDecartClient({ apiKey: DECART_API_KEY });

    const connectPromise = client.realtime.connect(localStream, {
      model,
      mirror: "auto",
      onRemoteStream: (remote) => {
        const v = $("#video-output");
        v.srcObject = remote;
        v.muted = true;
        v.play().catch(() => {});
        showEmpty(false);
      },
      onError: (err) => console.warn("[kids] realtime error", err),
    });

    const timeoutPromise = new Promise((_, reject) => {
      timeoutId = setTimeout(() => reject(new Error("Timeout")), 30000);
    });

    realtimeClient = await Promise.race([connectPromise, timeoutPromise]);
    clearTimeout(timeoutId);

    setStatus(t("transforming"));
    const file = await urlToFile("./assets/" + ch.ref, ch.ref);
    await realtimeClient.set({ prompt: ch.prompt, image: file, enhance: true });

    sessionActive = true;
    startPresenceWatch();
    setStatus(
      lang === "zh"
        ? `和 ${ch.name_zh || ch.name} ${t("performingWith")}`
        : `${t("performingWith")} ${ch.name}`
    );
    $("#btn-stop").classList.remove("hidden");
    updateLogoState();
    speakWelcome(ch);
  } catch (e) {
    clearTimeout(timeoutId);
    console.warn("[kids] transform failed", e);
    toast(`${t("transformFail")}: ${errText(e).slice(0, 50)}`);
    await stopTransform(false);
  } finally {
    updateLogoState();
  }
}

async function requestStop() {
  if (!sessionActive) return;
  const ok = window.confirm(t("endConfirm"));
  if (!ok) return;
  await stopTransform(true);
}

async function stopTransform(showToast = true) {
  stopPresenceWatch();
  try {
    window.speechSynthesis?.cancel();
  } catch (_) {}
  if (realtimeClient) {
    try {
      realtimeClient.disconnect();
    } catch (_) {}
    realtimeClient = null;
  }
  sessionActive = false;
  switching = false;
  if (localStream) {
    try {
      localStream.getTracks().forEach((tr) => tr.stop());
    } catch (_) {}
    localStream = null;
  }
  const v = $("#video-output");
  if (v) v.srcObject = null;
  showEmpty(true);
  $("#btn-stop").classList.add("hidden");
  setStatus("", false);
  updateLogoState();
  if (showToast) toast(t("ended"));
}

function toggleLang() {
  lang = lang === "en" ? "zh" : "en";
  localStorage.setItem("kids_l1_lang", lang);
  applyI18n();
}

async function init() {
  applyI18n();
  if (!DECART_API_KEY || DECART_API_KEY === "YOUR_API_KEY_HERE") {
    setStatus(t("missingKey"));
  }
  const res = await fetch("./characters.json");
  const data = await res.json();
  characters = data.characters || [];
  applyLayoutFromStorage();
  renderChars();
  showEmpty(true);
  updateLogoState();
  $("#btn-logo-start").onclick = () => startTransform();
  $("#btn-stop").onclick = () => requestStop();
  $("#btn-lang").onclick = () => toggleLang();

  window.addEventListener("beforeunload", () => {
    try {
      realtimeClient?.disconnect();
    } catch (_) {}
  });
}

init().catch((e) => {
  console.error(e);
  toast(errText(e));
});
