const origin = location.origin + location.pathname.replace(/[^/]+$/, "");
const APP_SRC = "https://cdn.jsdelivr.net/gh/jtsgai/medhug-cabin@424f015159b7b2cca6cacb471eaf6aae439bc1ab/app.js";
const code = (await fetch(APP_SRC).then((r) => {
  if (!r.ok) throw new Error("cannot load app core");
  return r.text();
}))
  .replace(
    "n.realtime.connect(localStream,{",
    "n.realtime.connect((window.__jtVtonIn||localStream),{"
  )
  .replaceAll('from"./config.js"', `from"${origin}config.js"`)
  .replaceAll('from"./i18n.js"', `from"${origin}i18n.js"`)
  .replace(
    'function disconnectApi(){',
    'function disconnectApi(){window.UsageClient?.stop("tryon");'
  )
  .replace(
    'if(!DECART_API_KEY||"YOUR_API_KEY_HERE"===DECART_API_KEY)return showApiCreditHint(!0),void setStatusKey("status_camera");setStatusKey("status_connecting");try{',
    'if(!DECART_API_KEY||"YOUR_API_KEY_HERE"===DECART_API_KEY)return showApiCreditHint(!0),void setStatusKey("status_camera");window.UsageClient?.start("tryon");setStatusKey("status_connecting");try{'
  )
  .replace(
    'function endSession(){',
    'function endSession(){window.UsageClient?.stop("tryon");'
  );
await import(URL.createObjectURL(new Blob([code], { type: "text/javascript" })));
