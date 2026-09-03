import { LIVEAVATAR_EMBED_URL, LIVEAVATAR_TOKEN_URL, SESSION_MS } from "./config.js";

const idle = document.getElementById("idle");
const frame = document.getElementById("avatar-frame");
const video = document.getElementById("avatar-video");
const btnStart = document.getElementById("btn-start");
const btnEnd = document.getElementById("btn-end");
const statusEl = document.getElementById("status");
const setupHint = document.getElementById("setup-hint");

let session = null;
let timer = null;
let active = false;

function setStatus(text) {
  if (!text) {
    statusEl.classList.add("hidden");
    statusEl.textContent = "";
    return;
  }
  statusEl.textContent = text;
  statusEl.classList.remove("hidden");
}

function showIdle() {
  active = false;
  idle.classList.remove("hidden");
  btnEnd.classList.add("hidden");
  frame.classList.add("hidden");
  frame.src = "about:blank";
  video.classList.add("hidden");
  video.srcObject = null;
  setStatus("");
}

function showTalking() {
  active = true;
  idle.classList.add("hidden");
  btnEnd.classList.remove("hidden");
}

async function startEmbed(url) {
  frame.src = url;
  frame.classList.remove("hidden");
  showTalking();
  setStatus("对话中 · Talking");
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
  try {
    if (LIVEAVATAR_EMBED_URL) {
      await startEmbed(LIVEAVATAR_EMBED_URL);
    } else if (LIVEAVATAR_TOKEN_URL) {
      await startSdk(LIVEAVATAR_TOKEN_URL);
    } else {
      setupHint.textContent = "先在 talk/config.js 填入 LIVEAVATAR_EMBED_URL（从 app.liveavatar.com 复制嵌入链接）。";
      setupHint.classList.remove("hidden");
      return;
    }
    timer = setTimeout(stop, SESSION_MS || 5 * 60 * 1000);
  } catch (err) {
    console.error(err);
    setupHint.textContent = "无法启动实时数字人：" + (err.message || err);
    setupHint.classList.remove("hidden");
    showIdle();
  }
}

async function stop() {
  clearTimeout(timer);
  timer = null;
  try {
    if (session && session.stop) await session.stop();
  } catch (e) {}
  session = null;
  showIdle();
}

btnStart.addEventListener("click", start);
btnEnd.addEventListener("click", stop);
window.addEventListener("pagehide", stop);

if (!LIVEAVATAR_EMBED_URL && !LIVEAVATAR_TOKEN_URL) {
  setupHint.textContent = "未配置 LiveAvatar。可先点开始查看提示，或在 talk/config.js 填入嵌入链接。";
  setupHint.classList.remove("hidden");
}
