import { ORCHESTRATOR_URL, SESSION_MS, AVATAR_LABEL } from "./config.js?v=20260912a";

const idle = document.getElementById("idle");
const hint = document.getElementById("setup-hint");
const btnStart = document.getElementById("btn-start");
const btnEnd = document.getElementById("btn-end");
const statusEl = document.getElementById("status");

let active = false;
let timer = null;
let tick = null;
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

function showIdle(msg) {
  active = false;
  document.body.classList.remove("is-talking");
  idle.classList.remove("hidden");
  btnEnd.classList.add("hidden");
  setStatus("");
  if (msg) {
    hint.textContent = msg;
    hint.classList.remove("hidden");
  }
}

function showTalking() {
  active = true;
  document.body.classList.add("is-talking");
  idle.classList.add("hidden");
  btnEnd.classList.remove("hidden");
}

async function start() {
  if (active) return;
  if (!ORCHESTRATOR_URL) {
    hint.textContent =
      "等待 GPT-Live Key 与中转服务。接上后填 talk-live/config.js 的 ORCHESTRATOR_URL。现在 /talk/ Embed 仍可用。";
    hint.classList.remove("hidden");
    return;
  }
  try {
    const res = await fetch(ORCHESTRATOR_URL.replace(/\/$/, "") + "/api/session/start", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ max_ms: SESSION_MS, label: AVATAR_LABEL }),
    });
    if (!res.ok) throw new Error("session start " + res.status);
    showTalking();
    endsAt = Date.now() + SESSION_MS;
    setStatus("LITE · " + remainingSec() + "s");
    clearInterval(tick);
    tick = setInterval(() => {
      const s = remainingSec();
      setStatus("LITE · " + s + "s");
      if (s <= 0) stop();
    }, 250);
    clearTimeout(timer);
    timer = setTimeout(stop, SESSION_MS);
  } catch (err) {
    showIdle("中转服务还未就绪：" + (err.message || err));
  }
}

function stop() {
  clearTimeout(timer);
  clearInterval(tick);
  showIdle("");
}

btnStart.addEventListener("click", start);
btnEnd.addEventListener("click", stop);
window.addEventListener("pagehide", stop);
