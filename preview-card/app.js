// Preview-card loader: fetches the SAME pinned core as the root app.js and patches it in memory.
// The pinned file on disk / jsDelivr is never modified. Every patch must match, otherwise we fail loudly
// (a silent miss would e.g. leave the raw 1920x1080 stream wired to Lucy or break asset paths).
const SITE = new URL("../", location.href).href; // parent of /preview-card/, e.g. https://host/
const APP_SRC = "https://cdn.jsdelivr.net/gh/jtsgai/medhug-cabin@424f015159b7b2cca6cacb471eaf6aae439bc1ab/app.js";

function reasonFromError(err) {
  // Chinese strings stay canonical (toasts / #tryon-reason / tests). English aliases are kept for i18n consistency.
  const texts = {
    busy: "摄像头被占用",
    denied: "摄像头未允许",
    timeout: "连接超时",
    credit: "额度不足",
    unavailable: "服务暂时不可用",
    fail: "连接失败",
  };
  const textsEn = {
    busy: "Camera is in use",
    denied: "Camera permission denied",
    timeout: "Connection timed out",
    credit: "Insufficient credits",
    unavailable: "Service temporarily unavailable",
    fail: "Connection failed",
  };
  void textsEn;
  const parts = [];
  const add = (e) => {
    if (!e) return;
    parts.push(String(e.name || ""), String(e.message || e || ""));
  };
  add(err);
  add(window.__jtLastCamError);
  const blob = parts.join(" ").toLowerCase();
  // Busy / in-use before permission: "no camera stream" used to be misread as 摄像头未允许 (P2-B).
  if (blob.includes("notreadable") || blob.includes("in use") || blob.includes("trackstart")
    || blob.includes("could not start") || blob.includes("device busy") || blob.includes("occupied")
    || blob.includes("被占用")) return texts.busy;
  if (blob.includes("notallowed") || blob.includes("permission") || blob.includes("camera gated")) return texts.denied;
  // Timeout must be classified before "credit": the core's 30s error is "API timeout credit or network".
  if (blob.includes("timeout") || blob.includes("network") || blob.includes("failed to fetch")) return texts.timeout;
  if (blob.includes("402") || blob.includes("credit") || blob.includes("insufficient") || blob.includes("额度")) return texts.credit;
  if (blob.includes("服务暂时不可用") || blob.includes("temporarily unavailable")) return texts.unavailable;
  return texts.fail;
}
window.__jtTryonReasonFrom = reasonFromError;
window.__jtFreshDecartToken = async () => {
  const response = await fetch("https://live.medhug.ai/api/decart-token", {
    method: "POST",
    credentials: "include",
  });
  if (!response.ok) throw new Error(response.status === 402 ? "额度不足" : "服务暂时不可用");
  const data = await response.json();
  if (!data.token) throw new Error("服务暂时不可用");
  return data.token;
};

// Connection generation: a late realtime.connect() after timeout / End / camera-off must disconnect
// immediately and must not attach its remote stream, set apiConnected, or start usage.
window.__jtTryonLive = false;
window.__jtConn = {
  gen: 0,
  current: 0,
  connecting: false,
  begin() {
    if (this.connecting) return null;
    this.connecting = true;
    this.current = ++this.gen;
    window.__jtTryonLive = false;
    document.body?.classList.add("is-connecting");
    document.body?.classList.remove("is-tryon-live");
    return this.current;
  },
  isCurrent(id) { return id != null && this.current === id; },
  succeed(id) {
    if (!this.isCurrent(id)) return false;
    this.connecting = false;
    window.__jtTryonLive = true;
    document.body?.classList.remove("is-connecting");
    document.body?.classList.add("is-tryon-live");
    return true;
  },
  invalidate() {
    this.current = -(this.gen || 1);
    this.connecting = false;
    window.__jtTryonLive = false;
    document.body?.classList.remove("is-connecting", "is-tryon-live");
  },
};

const report = [];
// Function replacers on purpose: String.replace would interpret "$" sequences in a replacement string.
// Default is a strict unique match (count === 1). Pass { all: true } or { expectedCount } to opt out.
function patch(code, name, from, to, { all = false, expectedCount } = {}) {
  const count = code.split(from).length - 1;
  const expected = expectedCount !== undefined ? expectedCount : (all ? count : 1);
  const ok = expectedCount !== undefined
    ? count === expectedCount
    : all ? count >= 1 : count === 1;
  report.push({ name, count, expected: expectedCount !== undefined ? expectedCount : (all ? undefined : 1), all, ok });
  if (!ok) throw new Error(`preview-card patch "${name}" did not match the pinned core (count=${count})`);
  return all ? code.split(from).join(to) : code.replace(from, () => to);
}

const raw = await fetch(APP_SRC).then((r) => {
  if (!r.ok) throw new Error("cannot load app core");
  return r.text();
});

let code = raw;
// --- same patches as the root app.js ---
code = patch(code, "config-import", 'import{DECART_API_KEY}from"./config.js";', 'const DECART_API_KEY="fresh";');
code = patch(code, "token-inject",
  'const e=models.realtime("lucy-vton-latest"),n=createDecartClient({apiKey:DECART_API_KEY})',
  'const e=models.realtime("lucy-vton-latest"),__jtTok=await window.__jtFreshDecartToken(),n=createDecartClient({apiKey:__jtTok})');
// Lucy gets the 720x1280 canvas stream, never the raw camera stream (throws if it is not ready).
code = patch(code, "connect-input", "n.realtime.connect(localStream,{", "n.realtime.connect(window.__jtRequireVtonIn(),{");
code = patch(code, "disconnect-usage", "function disconnectApi(){", 'function disconnectApi(){window.__jtConn.invalidate();window.UsageClient?.stop("tryon");');
// NOTE: the root app.js pattern starts with "if(" but in the pinned core this check is the tail of a comma
// expression (`if(enterTryOnUiPreview(t),...,!DECART_API_KEY||...)`), so the root replace never matched. It is
// harmless there only because DECART_API_KEY is "fresh". Here we match the real text so the early return is gone.
code = patch(code, "skip-empty-key",
  '!DECART_API_KEY||"YOUR_API_KEY_HERE"===DECART_API_KEY)return showApiCreditHint(!0),void setStatusKey("status_camera");setStatusKey("status_connecting");try{',
  '!1)return;setStatusKey("status_connecting");try{');
code = patch(code, "end-usage", "function endSession(){", 'function endSession(){window.__jtConn.invalidate();window.UsageClient?.stop("tryon");');
code = patch(code, "toast-reason",
  'toast(String(t&&t.message||t||"API连接失败").slice(0,80))',
  'window.__jtTryonReason?.(window.__jtTryonReasonFrom?.(t)||"连接失败")');

// --- preview-card path rewrites: the page lives in /preview-card/, the core expects the site root ---
code = patch(code, "import-config", 'from"./config.js"', `from"${SITE}config.js"`, { all: true, expectedCount: 0 });
code = patch(code, "import-i18n", 'from"./i18n.js"', `from"${SITE}i18n.js"`, { all: true, expectedCount: 1 });
// Covers ASSETS_BASE, urlToFile("./assets/"+...), modal src and the template-literal <img src="./assets/${...}">.
code = patch(code, "assets", "./assets/", "../assets/", { all: true, expectedCount: 9 });
code = patch(code, "catalog", '"./catalog.json"', '"../catalog.json"');
code = patch(code, "layout", '"./layout.json"', '"../layout.json"');
code = patch(code, "attract-paths", '"./attract/"', '"../attract/"', { all: true, expectedCount: 1 });
code = patch(code, "attract-playlist", '"./attract/playlist.json"', '"../attract/playlist.json"', { expectedCount: 1 });

// --- preview-card layout / stream isolation ---
// The pinned applyLayoutVars() shrinks .cabin-stage to a phone-like frame (min(560px,96vw)...). Keep the
// function (other call sites exist) but make it a no-op; layout is done only by preview-card.css.
code = patch(code, "applyLayoutVars-noop", "function applyLayoutVars(){", "function applyLayoutVars(){return;");
// Local preview shows ONLY the shared 720x1280 canvas stream, never the raw (1920x1080) camera stream.
code = patch(code, "showLocalPreview",
  'function showLocalPreview(){const t=$("#video-output");localStream&&(t.srcObject=localStream,$("#video-placeholder").classList.add("hidden"))}',
  'function showLocalPreview(){const t=$("#video-output");if(!t||!localStream)return;const s=window.__jtVtonIn;if(!s){window.__jtWhenVtonIn?.(showLocalPreview);return}t.srcObject!==s&&(t.srcObject=s);$("#video-placeholder").classList.add("hidden")}');
// Attract mode off for cabin trials: start interactive, force the flag after load, and no-op showAttract().
code = patch(code, "attract-initial-mode", 'mode="attract",presenceSince=null', 'mode="interactive",presenceSince=null');
code = patch(code, "attract-flag",
  "applyLayoutVars(),applyI18n(),renderCats(),renderFeatured(),renderExplore(),renderShortlist()}",
  "layout.attract_enabled=!1,applyLayoutVars(),applyI18n(),renderCats(),renderFeatured(),renderExplore(),renderShortlist()}");
code = patch(code, "attract-noop", "function showAttract(){", "function showAttract(){return;");

// --- connection generation, late-connect cleanup, no double try-on, camera-off stops usage ---
code = patch(code, "connect-begin",
  "async function connectApiAndTry(t){clearError();",
  "async function connectApiAndTry(t){if(window.__jtConn.connecting)return;const __gen=window.__jtConn.begin();if(__gen==null)return;clearError();");
code = patch(code, "onRemoteStream-gen",
  'onRemoteStream:t=>{$("#video-output").srcObject=t,$("#video-placeholder").classList.add("hidden"),showApiCreditHint(!1)}',
  'onRemoteStream:t=>{if(!window.__jtConn.isCurrent(__gen))return;$("#video-output").srcObject=t,$("#video-placeholder").classList.add("hidden"),showApiCreditHint(!1)}');
code = patch(code, "connect-assign-gen",
  "realtimeClient=a,apiConnected=!0,boostEndLater(),await applyGarment(t)",
  "if(!window.__jtConn.isCurrent(__gen)){try{a.disconnect()}catch(_){}return}realtimeClient=a,apiConnected=!0,boostEndLater(),await applyGarment(t)");
code = patch(code, "start-local-camera-req",
  'async function startLocalCamera(){if(localStream){const t=localStream.getVideoTracks?.()||[];if(localStream.active&&t.some(t=>"live"===t.readyState))return showLocalPreview(),localStream;try{localStream.getTracks().forEach(t=>t.stop())}catch(t){}localStream=null}try{return localStream=await navigator.mediaDevices.getUserMedia({audio:!1,video:{facingMode:"user",width:{ideal:720},height:{ideal:1280},frameRate:{ideal:30}}}),showLocalPreview(),setStatusKey("status_camera"),localStream}catch(t){return console.warn("[JT] camera",t),localStream=null,null}}',
  'async function startLocalCamera(){const __req=(window.__jtCamStart=(window.__jtCamStart||0)+1);if(localStream){const t=localStream.getVideoTracks?.()||[];if(localStream.active&&t.some(t=>"live"===t.readyState))return showLocalPreview(),localStream;try{localStream.getTracks().forEach(t=>t.stop())}catch(t){}localStream=null}try{const __s=await navigator.mediaDevices.getUserMedia({audio:!1,video:{facingMode:"user",width:{ideal:720},height:{ideal:1280},frameRate:{ideal:30}}});if(__req!==window.__jtCamStart){if(__s&&__s!==localStream){try{__s.getTracks().forEach(t=>t.stop())}catch(_){}}return localStream}return localStream=__s,showLocalPreview(),setStatusKey("status_camera"),localStream}catch(t){return console.warn("[JT] camera",t),__req!==window.__jtCamStart?localStream:(localStream=null,null)}}');
code = patch(code, "start-camera-gen-guard",
  "try{localStream||await startLocalCamera()}catch(t){}if(enterTryOnUiPreview(t),",
  "try{localStream||await startLocalCamera()}catch(t){window.__jtLastCamError=t}if(!window.__jtConn.isCurrent(__gen)||!cameraEnabled){if(window.__jtConn.isCurrent(__gen)){try{localStream&&localStream.getTracks().forEach(t=>t.stop())}catch(_){}localStream=null;window.jtPortraitIn?.(null);window.__jtConn.invalidate()}return}if(!localStream){window.__jtTryonReason?.(window.__jtTryonReasonFrom?.(window.__jtLastCamError)||\"连接失败\");window.__jtConn.invalidate();setStatusKey(\"status_camera\");return}if(enterTryOnUiPreview(t),");
code = patch(code, "timeout-error-text",
  'n=setTimeout(()=>e(new Error("API timeout credit or network")),3e4)',
  'n=setTimeout(()=>e(new Error("API timeout or network")),window.__jtConnectTimeoutMs||3e4)');
code = patch(code, "connect-catch-invalidate",
  '}catch(t){if(console.warn("[JT] API connect failed",t)',
  '}catch(t){if(!window.__jtConn.isCurrent(__gen))return;window.__jtConn.invalidate();if(console.warn("[JT] API connect failed",t)');
const usageOn = new URLSearchParams(location.search).get("usage") !== "0";
code = patch(code, "race-succeed",
  'clearTimeout(n),showApiCreditHint(!1),setStatusKey("status_live",!0)',
  'clearTimeout(n);if(!window.__jtConn.succeed(__gen))return;showApiCreditHint(!1),setStatusKey("status_live",!0)'
    + (usageOn ? ',window.UsageClient?.start("tryon")' : ""));
code = patch(code, "confirm-try-guard",
  "async function confirmTryOn(){const t=pendingGarmentId;",
  "async function confirmTryOn(){if(window.__jtConn.connecting)return;const t=pendingGarmentId;");
code = patch(code, "toggle-camera-off",
  "async function toggleCamera(){if(cameraEnabled){cameraEnabled=!1,localStream&&(localStream.getTracks().forEach(t=>t.stop()),localStream=null);const t=$(\"#video-output\");if(t&&(t.srcObject=null),realtimeClient){try{realtimeClient.disconnect()}catch(t){}realtimeClient=null,apiConnected=!1}setCameraOffStage(!0)}else",
  "async function toggleCamera(){if(cameraEnabled){cameraEnabled=!1,window.__jtCamGate?.markOff(!0),window.__jtConn.invalidate(),setStatusKey(\"status_camera\"),window.UsageClient?.stop(\"tryon\"),localStream&&(localStream.getTracks().forEach(t=>t.stop()),localStream=null);const t=$(\"#video-output\");if(t&&(t.srcObject=null),realtimeClient){try{realtimeClient.disconnect()}catch(t){}realtimeClient=null,apiConnected=!1}window.jtPortraitIn?.(null),setCameraOffStage(!0)}else");

window.__jtPreviewPatchReport = report;
await import(URL.createObjectURL(new Blob([code], { type: "text/javascript" })));
