// Preview-card loader: fetches the SAME pinned core as the root app.js and patches it in memory.
// The pinned file on disk / jsDelivr is never modified. Every patch must match, otherwise we fail loudly
// (a silent miss would e.g. leave the raw 1920x1080 stream wired to Lucy or break asset paths).
const SITE = new URL("../", location.href).href; // parent of /preview-card/, e.g. https://host/
const APP_SRC = "https://cdn.jsdelivr.net/gh/jtsgai/medhug-cabin@424f015159b7b2cca6cacb471eaf6aae439bc1ab/app.js";

function reasonFromError(err) {
  const raw = String(err && err.message || err || "").toLowerCase();
  if (raw.includes("notallowed") || raw.includes("permission") || raw.includes("no camera")) return "摄像头未允许";
  if (raw.includes("402") || raw.includes("credit") || raw.includes("insufficient") || raw.includes("额度")) return "额度不足";
  if (raw.includes("timeout") || raw.includes("network") || raw.includes("failed to fetch")) return "连接超时";
  if (raw.includes("服务暂时不可用")) return "服务暂时不可用";
  return "连接失败";
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

const report = [];
// Function replacers on purpose: String.replace would interpret "$" sequences in a replacement string.
function patch(code, name, from, to, { all = false, min = 1 } = {}) {
  const count = code.split(from).length - 1;
  if (count < min) {
    report.push({ name, count, ok: false });
    throw new Error(`preview-card patch "${name}" did not match the pinned core`);
  }
  report.push({ name, count, ok: true });
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
code = patch(code, "disconnect-usage", "function disconnectApi(){", 'function disconnectApi(){window.UsageClient?.stop("tryon");');
// NOTE: the root app.js pattern starts with "if(" but in the pinned core this check is the tail of a comma
// expression (`if(enterTryOnUiPreview(t),...,!DECART_API_KEY||...)`), so the root replace never matched. It is
// harmless there only because DECART_API_KEY is "fresh". Here we match the real text so the early return is gone.
code = patch(code, "skip-empty-key",
  '!DECART_API_KEY||"YOUR_API_KEY_HERE"===DECART_API_KEY)return showApiCreditHint(!0),void setStatusKey("status_camera");setStatusKey("status_connecting");try{',
  '!1)return;setStatusKey("status_connecting");try{');
code = patch(code, "end-usage", "function endSession(){", 'function endSession(){window.UsageClient?.stop("tryon");');
code = patch(code, "toast-reason",
  'toast(String(t&&t.message||t||"API连接失败").slice(0,80))',
  'window.__jtTryonReason?.(window.__jtTryonReasonFrom?.(t)||"连接失败")');

// --- preview-card path rewrites: the page lives in /preview-card/, the core expects the site root ---
code = patch(code, "import-config", 'from"./config.js"', `from"${SITE}config.js"`, { all: true, min: 0 });
code = patch(code, "import-i18n", 'from"./i18n.js"', `from"${SITE}i18n.js"`, { all: true });
// Covers ASSETS_BASE, urlToFile("./assets/"+...), modal src and the template-literal <img src="./assets/${...}">.
code = patch(code, "assets", "./assets/", "../assets/", { all: true, min: 9 });
code = patch(code, "catalog", '"./catalog.json"', '"../catalog.json"');
code = patch(code, "layout", '"./layout.json"', '"../layout.json"');
code = patch(code, "attract-paths", '"./attract/"', '"../attract/"', { all: true, min: 1 });
code = patch(code, "attract-playlist", '"./attract/playlist.json"', '"../attract/playlist.json"', { min: 0 });

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
// Usage: start the tryon timer after a successful connect (stop is patched into disconnectApi/endSession above).
if (new URLSearchParams(location.search).get("usage") !== "0") {
  code = patch(code, "usage-start",
    'clearTimeout(n),showApiCreditHint(!1),setStatusKey("status_live",!0)',
    'clearTimeout(n),showApiCreditHint(!1),setStatusKey("status_live",!0),window.UsageClient?.start("tryon")');
}

window.__jtPreviewPatchReport = report;
await import(URL.createObjectURL(new Blob([code], { type: "text/javascript" })));
