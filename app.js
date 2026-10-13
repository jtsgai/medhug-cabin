const origin = location.origin + location.pathname.replace(/[^/]+$/, "");
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

const code = (await fetch(APP_SRC).then((r) => {
  if (!r.ok) throw new Error("cannot load app core");
  return r.text();
}))
  .replace(
    'import{DECART_API_KEY}from"./config.js";',
    'const DECART_API_KEY="fresh";'
  )
  .replace(
    'const e=models.realtime("lucy-vton-latest"),n=createDecartClient({apiKey:DECART_API_KEY})',
    'const e=models.realtime("lucy-vton-latest"),__jtTok=await window.__jtFreshDecartToken(),n=createDecartClient({apiKey:__jtTok})'
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
    'setStatusKey("status_connecting");try{'
  )
  .replace(
    "function endSession(){",
    'function endSession(){window.UsageClient?.stop("tryon");'
  )
  .replace(
    'toast(String(t&&t.message||t||"API连接失败").slice(0,80))',
    'window.__jtTryonReason?.(window.__jtTryonReasonFrom?.(t)||"连接失败")'
  );

await import(URL.createObjectURL(new Blob([code], { type: "text/javascript" })));
