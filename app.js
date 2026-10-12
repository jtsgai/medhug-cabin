const origin = location.origin + location.pathname.replace(/[^/]+$/, "");
const APP_SRC = "https://cdn.jsdelivr.net/gh/jtsgai/medhug-cabin@424f015159b7b2cca6cacb471eaf6aae439bc1ab/app.js";

function reasonFromError(err) {
  const raw = String(err && err.message || err || "").toLowerCase();
  if (raw.includes("notallowed") || raw.includes("permission") || raw.includes("no camera")) return "\u6444\u50cf\u5934\u672a\u5141\u8bb8";
  if (raw.includes("402") || raw.includes("credit") || raw.includes("insufficient") || raw.includes("\u989d\u5ea6")) return "\u989d\u5ea6\u4e0d\u8db3";
  if (raw.includes("timeout") || raw.includes("network") || raw.includes("failed to fetch")) return "\u8fde\u63a5\u8d85\u65f6";
  return "\u8fde\u63a5\u5931\u8d25";
}
window.__jtTryonReasonFrom = reasonFromError;

let token = "";
try {
  const response = await fetch("https://live.medhug.ai/api/decart-token", {
    method: "POST",
    credentials: "include",
  });
  if (response.ok) {
    const data = await response.json();
    token = data.token || "";
  } else {
    window.__jtTryonReason?.(response.status === 402 ? "\u989d\u5ea6\u4e0d\u8db3" : "\u670d\u52a1\u6682\u65f6\u4e0d\u53ef\u7528");
  }
} catch {
  window.__jtTryonReason?.("\u670d\u52a1\u6682\u65f6\u4e0d\u53ef\u7528");
}

const code = (await fetch(APP_SRC).then((r) => {
  if (!r.ok) throw new Error("cannot load app core");
  return r.text();
}))
  .replace(
    'import{DECART_API_KEY}from"./config.js";',
    `const DECART_API_KEY=${JSON.stringify(token)};`
  )
  .replace(
    "n.realtime.connect(localStream,{",
    "n.realtime.connect((window.__jtVtonIn||localStream),{"
  )
  .replaceAll('from"./config.js"', `from"${origin}config.js"`)
  .replaceAll('from"./i18n.js"', `from"${origin}i18n.js"`)
  .replace(
    "function disconnectApi(){",
    'function disconnectApi(){window.UsageClient?.stop("tryon");'
  )
  .replace(
    'if(!DECART_API_KEY||"YOUR_API_KEY_HERE"===DECART_API_KEY)return showApiCreditHint(!0),void setStatusKey("status_camera");setStatusKey("status_connecting");try{',
    'if(!DECART_API_KEY||"YOUR_API_KEY_HERE"===DECART_API_KEY)return window.__jtTryonReason?.("\u670d\u52a1\u6682\u65f6\u4e0d\u53ef\u7528"),void setStatusKey("status_camera");window.UsageClient?.start("tryon");setStatusKey("status_connecting");try{'
  )
  .replace(
    "function endSession(){",
    'function endSession(){window.UsageClient?.stop("tryon");'
  )
  .replace(
    'toast(String(t&&t.message||t||"API\u8fde\u63a5\u5931\u8d25").slice(0,80))',
    'window.__jtTryonReason?.(window.__jtTryonReasonFrom?.(t)||"\u8fde\u63a5\u5931\u8d25")'
  );

await import(URL.createObjectURL(new Blob([code], { type: "text/javascript" })));
