const APP_SRC = "https://cdn.jsdelivr.net/gh/jtsgai/medhug-cabin@424f015159b7b2cca6cacb471eaf6aae439bc1ab/app.js";
const code = (await fetch(APP_SRC).then((r) => {
  if (!r.ok) throw new Error("cannot load app core");
  return r.text();
}))
  .replace('mirror:"auto",onRemoteStream', 'mirror:"auto",resolution:"1080p",onRemoteStream')
  .replaceAll('from"./config.js"', 'from"./config.js?v=1080"')
  .replaceAll('from"./i18n.js"', 'from"./i18n.js?v=1080"');
await import(URL.createObjectURL(new Blob([code], { type: "text/javascript" })));
