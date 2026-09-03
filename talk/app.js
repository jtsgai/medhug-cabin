import { LIVEAVATAR_EMBED_URL, LIVEAVATAR_TOKEN_URL, SESSION_MS } from "./config.js?v=20260903j";

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
let localMic = null;

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
  if (localMic) {
    localMic.getTracks().forEach((t) => t.stop());
    localMic = null;
  }
}

function showTalking() {
  active = true;
  document.body.classList.add("is-talking");
  idle.classList.add("hidden");
  btnEnd.classList.remove("hidden");
}

function isCameraMic(label) {
  const s = (label || "").toLowerCase();
  return /camera|webcam|hd camera|integrated/.test(s);
}

async function armCabinMic() {
  localMic = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
  const devices = await navigator.mediaDevices.enumerateDevices();
  const mics = devices.filter((d) => d.kind === "audioinput");
  const cabin = mics.find((d) => !isCameraMic(d.label));
  const using = cabin || mics[0];
  if (cabin && localMic.getAudioTracks()[0]) {
    try {
      localMic.getTracks().forEach((t) => t.stop());
      localMic = await navigator.mediaDevices.getUserMedia({
        audio: { deviceId: { ideal: cabin.deviceId } },
        video: false,
      });
    } catch (e) {}
  }
  const name = (using && using.label) || "microphone";
  if (isCameraMic(name)) {
    setStatus("当前可能是摄像头麦 · 请改系统默认输入");
  }
}

async function startEmbed(url) {
  frame.src = url;
  frame.classList.remove("hidden");
  showTalking();
}

async function start() {
  if (active) return;
  clearTimeout(timer);
  clearInterval(tick);
  try {
    await armCabinMic();
  } catch (err) {
    setupHint.textContent = "请允许麦克风，并在系统声音设置里选舱体麦。";
    setupHint.classList.remove("hidden");
    return;
  }
  try {
    if (LIVEAVATAR_EMBED_URL) {
      await startEmbed(LIVEAVATAR_EMBED_URL);
    } else {
      setupHint.textContent = "先在 talk/config.js 填入 LIVEAVATAR_EMBED_URL。";
      setupHint.classList.remove("hidden");
      return;
    }
    const ms = SESSION_MS || 2 * 60 * 1000;
    endsAt = Date.now() + ms;
    startCountdown();
    timer = setTimeout(stop, ms);
    setTimeout(() => frame.focus(), 400);
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
