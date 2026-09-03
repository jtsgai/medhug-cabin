import { LIVEAVATAR_EMBED_URL, LIVEAVATAR_TOKEN_URL, SESSION_MS } from "./config.js?v=20260903e";

const idle = document.getElementById("idle");
const frame = document.getElementById("avatar-frame");
const video = document.getElementById("avatar-video");
const btnStart = document.getElementById("btn-start");
const btnEnd = document.getElementById("btn-end");
const statusEl = document.getElementById("status");
const setupHint = document.getElementById("setup-hint");

let session = null;
let timer = null;
let tick = null;
let active = false;
let endsAt = 0;

function setStatus(text) {
  if (!text) {
    statusEl.classList.add("hidden");
    statusEl.textContent = "";
    return;
  }
  statusEl.textContent = text;
  statusEl.classList.remove("hidden");
}

function remainingSec() {
  return Math.max(0, Math.ceil((endsAt - Date.now()) / 1000));
}

function startCountdown() {
  clearInterval(tick);
  tick = setInterval(() => {
    const s = remainingSec();
    setStatus("对话中 · " + s + "s");
    if (s <= 0) stop();
  }, 250);
}

function showIdle() {
  active = false;
  document.body.classList.remove("is-talking");
  idle.classList.remove("hidden");
  btnEnd.classList.add("hidden");
  frame.classList.add("hidden");
  frame.removeAttribute("src");
  frame.src = "about:blank";
  video.classList.add("hidden");
  video.srcObject = null;
  setStatus("");
}

function showTalking() {
  active = true;
  document.body.classList.add("is-talking");
  idle.classList.add("hidden");
  btnEnd.classList.remove("hidden");
}

async function startEmbed(url) {
  frame.src = url;
  frame.classList.remove("hidden");
  showTalking();
  setStatus("对话中 · " + Math.round((SESSION_MS || 30000) / 1000) + "s");
}

async function startSdk(tokenUrl) {
  const res = await fetch(tokenUrl, { method: "POST" });
  if (!res.ok) throw new Error("token " + res.status);
  const data = await res.json();
  const token = data.sessionToken || data.session_token || data.token;
  if (!token) throw new Error("no session token");

  const mod = await import("https://esm.sh/@heygen/liveavatar-web-sdk");
  const LiveAvatarSession = mod.LiveAvatarSession || mod.default;
  session = new LiveAvatarSession(token, { voiceChat: true });
  await session.start();

  const media = session.mediaStream || session.stream || session.videoStream;
  if (media) {
    video.srcObject = media;
    video.classList.remove("hidden");
  }
  showTalking();
  setStatus("对话中 · Talking");
}

async function start() {
  if (active) return;
  clearTimeout(timer);
  clearInterval(tick);
  try {
    if (LIVEAVATAR_EMBED_URL) {
      await startEmbed(LIVEAVATAR_EMBED_URL);
    } else if (LIVEAVATAR_TOKEN_URL) {
      await startSdk(LIVEAVATAR_TOKEN_URL);
    } else {
      setupHint.textContent = "先在 talk/config.js 填入 LIVEAVATAR_EMBED_URL。";
      setupHint.classList.remove("hidden");
      return;
    }
    const ms = SESSION_MS || 30 * 1000;
    endsAt = Date.now() + ms;
    startCountdown();
    timer = setTimeout(stop, ms);
  } catch (err) {
    console.error(err);
    setupHint.textContent = "无法启动实时数字人：" + (err.message || err);
    setupHint.classList.remove("hidden");
    showIdle();
  }
}

async function stop() {
  clearTimeout(timer);
  clearInterval(tick);
  timer = null;
  tick = null;
  try {
    if (session && session.stop) await session.stop();
  } catch (e) {}
  session = null;
  showIdle();
}

btnStart.addEventListener("click", start);
btnEnd.addEventListener("click", stop);
window.addEventListener("pagehide", stop);
window.addEventListener("beforeunload", stop);
