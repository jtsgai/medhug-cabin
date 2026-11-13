#!/usr/bin/env node
// Checks for the isolated /preview-card/ route.
//   node preview-card/check-preview-card.mjs               # unit + static + headless Chromium
//   node preview-card/check-preview-card.mjs --no-browser  # unit + static only
// Env: PREVIEW_CARD_SHOTS=<dir> screenshot dir (default: OS tmp dir), PLAYWRIGHT_MODULE=<path to playwright pkg>,
//      PLAYWRIGHT_CHROME=<chrome executable>. Playwright is NOT a dependency of this repo (static site, no package.json).
import { execFileSync, spawn } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, readdirSync } from "node:fs";
import { createRequire } from "node:module";
import net from "node:net";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  computeVtonLayout, genericCoverCrop, resolveFps, OBS_ROI,
  STATUS_OBS_CONTAIN, STATUS_GENERIC_COVER,
} from "./vton-in-math.js";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, "..");
const PINNED_SHA = "424f015159b7b2cca6cacb471eaf6aae439bc1ab";
const NO_BROWSER = process.argv.includes("--no-browser");
const SHOTS = process.env.PREVIEW_CARD_SHOTS || path.join(os.tmpdir(), "preview-card-shots");

let failures = 0;
let passes = 0;
function ok(cond, name, detail = "") {
  if (cond) { passes++; console.log(`PASS  ${name}`); } else { failures++; console.log(`FAIL  ${name}${detail ? "  -> " + detail : ""}`); }
}
const near = (a, b, tol = 0.05) => Math.abs(a - b) <= tol;
function section(t) { console.log(`\n== ${t} ==`); }

// ------------------------------------------------------------------ 1. unit: computeVtonLayout
section("computeVtonLayout (Node, no DOM)");
{
  const on = { obsPresetEnabled: true, fps: 20 };
  const a = computeVtonLayout(1920, 1080, on);
  ok(a.status === STATUS_OBS_CONTAIN && a.reason === "preset-hit", "1920x1080 + preset ON -> obs-contain / preset-hit", JSON.stringify(a));
  ok(a.src.sx === 556 && a.src.sy === 1 && a.src.sw === 808 && a.src.sh === 1078, "1920x1080 ON: crop [556,1,808,1078]");
  ok(near(a.dst.dw, 720) && near(a.dst.dh, 960.5911) && near(a.dst.dx, 0) && near(a.dst.dy, 159.7045), "1920x1080 ON: dw=720 dh~960.5911 dx=0 dy~159.7045", JSON.stringify(a.dst));
  ok(near(a.dst.dy * 2 + a.dst.dh, 1280, 1e-9), "1920x1080 ON: top/bottom padding symmetric inside 1280");

  const b = computeVtonLayout(1280, 720, on);
  ok(b.status === STATUS_GENERIC_COVER && b.reason === "preset-miss", "1280x720 + ON -> generic-cover / preset-miss");
  ok(near(b.src.sw, 405) && near(b.src.sx, 437.5) && near(b.src.sy, 0) && near(b.src.sh, 720), "1280x720 ON: sw=405 sx=437.5 (no OBS ROI)", JSON.stringify(b.src));

  const c = computeVtonLayout(720, 1280, on);
  ok(c.status === STATUS_GENERIC_COVER && c.reason === "preset-miss", "720x1280 + ON -> generic-cover / preset-miss");
  ok(c.src.sx === 0 && c.src.sy === 0 && c.src.sw === 720 && c.src.sh === 1280, "720x1280 ON: full frame crop", JSON.stringify(c.src));

  const d = computeVtonLayout(1920, 1080, { obsPresetEnabled: false, fps: 20 });
  ok(d.status === STATUS_GENERIC_COVER && d.reason === "preset-off", "1920x1080 + OFF -> generic-cover / preset-off");
  ok(near(d.src.sw, 607.5) && near(d.src.sx, 656.25) && near(d.src.sh, 1080), "1920x1080 OFF: sw=607.5 sx=656.25", JSON.stringify(d.src));
  ok(d.dst.dx === 0 && d.dst.dy === 0 && d.dst.dw === 720 && d.dst.dh === 1280, "generic cover draws to (0,0,720,1280)");

  for (const [w, h] of [[1920, 1081], [1919, 1080], [1080, 1920], [3840, 2160], [640, 480]]) {
    const r = computeVtonLayout(w, h, on);
    ok(r.status === STATUS_GENERIC_COVER && r.reason === "preset-miss", `${w}x${h} + ON never uses the OBS ROI`);
  }
  const none = computeVtonLayout(0, 0, on);
  ok(none.status === STATUS_GENERIC_COVER && none.reason === "no-video" && none.src === null, "no measured size -> no-video, no crop");
  ok(computeVtonLayout(0, 0, { obsPresetEnabled: false }).reason === "preset-off", "no size + OFF -> preset-off");
  ok(computeVtonLayout(1920, 1080).reason === "preset-hit", "preset defaults to ON when omitted");
  ok(computeVtonLayout(1920, 1080, { fps: 20 }).fps === 20 && computeVtonLayout(1920, 1080, {}).fps === 20, "fps defaults to 20");
  ok(resolveFps("30") === 30 && resolveFps("abc") === 20 && resolveFps(0) === 20 && resolveFps(500) === 60, "resolveFps sanitises");
  ok(Object.isFrozen(OBS_ROI) && computeVtonLayout(1920, 1080).src !== OBS_ROI, "ROI constant is not handed out by reference");
  const g = genericCoverCrop(1920, 1080);
  ok(near(g.sx, 656.25) && near(g.sw, 607.5), "genericCoverCrop matches live vton-portrait.js math");
}

// ------------------------------------------------------------------ 2. static
section("static checks");
const files = readdirSync(HERE).filter((f) => /\.(js|mjs|html|css|md)$/.test(f));
const read = (f) => readFileSync(path.join(HERE, f), "utf8");
for (const f of files.filter((f) => /\.(js|mjs)$/.test(f))) {
  try { execFileSync(process.execPath, ["--check", path.join(HERE, f)], { stdio: "pipe" }); ok(true, `node --check ${f}`); }
  catch (e) { ok(false, `node --check ${f}`, String(e.stderr || e.message)); }
}
{
  const html = read("index.html");
  ok(!/force-cam/.test(html) && !/ui-over-video/.test(html), "index.html has no reference to force-cam.js / ui-over-video.css");
  ok(!/cabin-aspect/.test(html), "index.html does not load cabin-aspect.*");
  const linked = [...html.matchAll(/(?:href|src)="([^"]+)"/g)].map((m) => m[1]).filter((u) => /\.(css|js)(\?|$)/.test(u));
  ok(linked.every((u) => u.startsWith("./") || u === "../usage-client.js"), "only preview-card files + ../usage-client.js are loaded", linked.join(", "));
  const others = files.filter((f) => !/^check-preview-card\.mjs$|^README\.md$/.test(f)).map(read).join("\n");
  ok(!/force-cam\.js|ui-over-video\.css|cabin-aspect\.css/.test(others), "no force-cam / ui-over-video / cabin-aspect reference in runtime files");
  ok(!/import\s*\(/.test(others.replace(/await import\(URL\.createObjectURL/g, "")), "no dynamic imports other than the patched core blob");
  const app = read("app.js");
  ok(app.includes('"../catalog.json"') && app.includes('"../layout.json"') && app.includes('"../assets/"'), "app.js rewrites to ../catalog.json, ../layout.json, ../assets/");
  ok(app.includes(`@${PINNED_SHA}/app.js`), "app.js loads the pinned core SHA");
  ok(app.includes("https://live.medhug.ai/api/decart-token") && app.includes('credentials: "include"'), "fresh token fetch (credentials include)");
  const reasonBody = app.slice(app.indexOf("function reasonFromError"), app.indexOf("window.__jtTryonReasonFrom")).replace(/\/\/.*$/gm, "");
  ok(reasonBody.indexOf('raw.includes("timeout")') < reasonBody.indexOf('raw.includes("credit")') && reasonBody.includes('raw.includes("timeout")') && reasonBody.includes('raw.includes("credit")'), "reasonFromError checks timeout before credit");
  ok(app.includes("count === 1") && app.includes("expectedCount"), "patch helper defaults to strict unique matches");
  const gate = read("cam-gate.js");
  ok(/picked\.obs/.test(gate) && /ideal:\s*1920/.test(gate) && /ideal:\s*1080/.test(gate) && /resizeMode:\s*"none"/.test(gate), "cam-gate requests 1920×1080 resizeMode none for OBS");
  const obsLit = gate.slice(gate.indexOf("picked.obs"), gate.indexOf("width: { ideal: 720 }"));
  ok(obsLit.includes("1920") && obsLit.includes('resizeMode: "none"') && !obsLit.includes("aspectRatio"), "OBS constraint branch has no aspectRatio 9/16", obsLit.slice(0, 240));
  const css = read("preview-card.css");
  ok(/grid-auto-rows:\s*max-content/.test(css), "explore grid sets grid-auto-rows: max-content");
  ok(/\.left-panel\.collapsed \.rail-current \{[^}]*display:\s*flex/.test(css), "collapsed rail keeps .rail-current visible");
  const secretRe = /(sk-[A-Za-z0-9]{16,}|eyJ[A-Za-z0-9_-]{20,}|AKIA[0-9A-Z]{12,}|api[_-]?key["']?\s*[:=]\s*["'][A-Za-z0-9_\-]{16,}["']|Bearer\s+[A-Za-z0-9._-]{16,})/i;
  ok(!files.some((f) => f !== "check-preview-card.mjs" && secretRe.test(read(f))), "no key/token-looking strings in preview-card files");
  ok(readFileSync(path.join(REPO, "config.js"), "utf8").includes('DECART_API_KEY = ""'), "root config.js still has an empty key");
}
{
  const git = (...a) => execFileSync("git", a, { cwd: REPO, encoding: "utf8" }).trim();
  let names = [];
  try {
    names = [...git("diff", "--name-only", "origin/main").split("\n"), ...git("ls-files", "--others", "--exclude-standard").split("\n")].filter(Boolean);
  } catch (e) { ok(false, "git diff origin/main", String(e.message)); }
  ok(names.length > 0 && names.every((n) => n.startsWith("preview-card/")), "changed/untracked paths are ONLY under preview-card/", names.filter((n) => !n.startsWith("preview-card/")).join(", "));
  const staged = git("diff", "--name-only", "--cached");
  ok(staged === "" || staged.split("\n").every((n) => n.startsWith("preview-card/")), "nothing outside preview-card/ is staged");
  ok(!names.some((n) => /package(-lock)?\.json$|node_modules/.test(n)), "no package.json / node_modules added");
}

if (NO_BROWSER) { finish(); }

// ------------------------------------------------------------------ 3. browser
section("headless Chromium @ 1440x2560, dpr 1.5");

function loadPlaywright() {
  const cands = [process.env.PLAYWRIGHT_MODULE, "playwright"];
  try { cands.push(path.join(execFileSync("npm", ["root", "-g"], { encoding: "utf8" }).trim(), "playwright")); } catch { /* ignore */ }
  cands.push(path.join(os.homedir(), ".local/lib/node_modules/playwright"));
  const req = createRequire(import.meta.url);
  for (const c of cands.filter(Boolean)) { try { return req(c); } catch { /* next */ } }
  throw new Error("playwright module not found (set PLAYWRIGHT_MODULE)");
}

function freePort() {
  return new Promise((resolve, reject) => {
    const s = net.createServer();
    s.listen(0, "127.0.0.1", () => { const { port } = s.address(); s.close(() => resolve(port)); });
    s.on("error", reject);
  });
}

const STUB_SDK = `
export const models = { realtime: (name) => ({ __model: name }) };
export function createDecartClient(opts) {
  window.__stub = window.__stub || { calls: [] };
  window.__stub.apiKey = opts && opts.apiKey;
  return { realtime: { connect: async (stream, o) => {
    window.__stub.connectStarted = (window.__stub.connectStarted || 0) + 1;
    const delay = Number(window.__stubConnectDelay) || 0;
    if (delay) await new Promise((r) => setTimeout(r, delay));
    const client = {
      set: async (a) => { window.__stub.calls.push({ prompt: a.prompt, enhance: a.enhance, image: a.image && a.image.name, imageType: a.image && a.image.type }); },
      disconnect: () => { window.__stub.disconnected = (window.__stub.disconnected || 0) + 1; },
    };
    window.__stub.lastClient = client;
    window.__stub.connectStream = stream;
    window.__stub.connectOpts = { model: o.model && o.model.__model, mirror: o.mirror, hasOnRemote: typeof o.onRemoteStream === "function" };
    const remote = new MediaStream(stream.getVideoTracks());
    window.__stub.remote = remote;
    if (typeof o.onRemoteStream === "function") o.onRemoteStream(remote);
    return client;
  } } };
}`;

const SYNTH = `
window.__makeSynth = (w, h) => {
  const c = document.createElement("canvas"); c.width = w; c.height = h;
  const g = c.getContext("2d");
  let t = 0;
  const paint = () => {
    t++;
    g.fillStyle = "#c01010"; g.fillRect(0, 0, c.width, c.height);          // outside any ROI: red
    if (c.width === 1920 && c.height === 1080) { g.fillStyle = "#10a030"; g.fillRect(556, 1, 808, 1078); } // ROI: green
    else { g.fillStyle = "#10a030"; g.fillRect(c.width * 0.3, 0, c.width * 0.4, c.height); }
    g.fillStyle = "#e8d5b5"; g.beginPath(); g.ellipse(c.width / 2, c.height * 0.2, c.height * 0.07, c.height * 0.09, 0, 0, 7); g.fill();
    g.fillStyle = "#ddd"; g.fillRect(c.width / 2 - c.height * 0.12, c.height * 0.28, c.height * 0.24, c.height * 0.5);
    g.fillStyle = "#fff"; g.fillRect((t * 7) % c.width, c.height - 12, 12, 12);   // keeps frames coming
  };
  paint();
  const timer = setInterval(paint, 40);
  const stream = c.captureStream(25);
  return { canvas: c, stream, stop: () => clearInterval(timer) };
};`;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const box = async (page, sel) => page.$eval(sel, (el) => { const r = el.getBoundingClientRect(); return { x: r.x, y: r.y, w: r.width, h: r.height, r: r.right, b: r.bottom }; });
const intersects = (a, b) => a.x < b.r - 0.5 && b.x < a.r - 0.5 && a.y < b.b - 0.5 && b.y < a.b - 0.5;
async function cardOverlap(page) {
  return page.$$eval("#explore-list .explore-card:not(.placeholder)", (cs) => {
    const rects = cs.map((c, i) => {
      const r = c.getBoundingClientRect();
      const st = getComputedStyle(c);
      return { i, x: r.x, y: r.y, w: r.width, h: r.height, r: r.right, b: r.bottom, disp: st.display, vis: st.visibility };
    }).filter((r) => r.w > 1 && r.h > 1 && r.disp !== "none" && r.vis !== "hidden");
    const overlaps = [];
    for (let i = 0; i < rects.length; i++) {
      for (let j = i + 1; j < rects.length; j++) {
        const a = rects[i], b = rects[j];
        if (a.x < b.r - 0.5 && b.x < a.r - 0.5 && a.y < b.b - 0.5 && b.y < a.b - 0.5) overlaps.push([a.i, b.i, a, b]);
      }
    }
    return { n: rects.length, overlaps };
  });
}

const { chromium } = loadPlaywright();
const port = await freePort();
const server = spawn("python3", ["-m", "http.server", String(port), "--bind", "127.0.0.1"], { cwd: REPO, stdio: "ignore" });
const BASE = `http://127.0.0.1:${port}`;
for (let i = 0; i < 50; i++) { try { const r = await fetch(`${BASE}/preview-card/index.html`); if (r.ok) break; } catch { /* wait */ } await sleep(100); }
mkdirSync(SHOTS, { recursive: true });

const pinnedCore = execFileSync("git", ["show", `${PINNED_SHA}:app.js`], { cwd: REPO, encoding: "utf8", maxBuffer: 1 << 26 });
const chromePath = process.env.PLAYWRIGHT_CHROME || (existsSync("/usr/bin/google-chrome") ? "/usr/bin/google-chrome" : undefined);
const browser = await chromium.launch({
  headless: true,
  executablePath: chromePath,
  args: ["--use-fake-device-for-media-stream", "--use-fake-ui-for-media-stream", "--autoplay-policy=no-user-gesture-required", "--no-sandbox"],
});

async function newPage(query = "", { stubs = true, testCam = "" } = {}) {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 2560 }, deviceScaleFactor: 1.5, permissions: ["camera"] });
  const page = await ctx.newPage();
  const errors = [];
  const usageHits = [];
  page.on("console", (m) => { if (m.type() === "error") errors.push(`console.error: ${m.text()}`); });
  page.on("pageerror", (e) => errors.push(`pageerror: ${e.message}`));
  const cors = (route, extra = {}) => ({
    "access-control-allow-origin": route.request().headers().origin || "*",
    "access-control-allow-credentials": "true",
    "access-control-allow-headers": "content-type",
    ...extra,
  });
  // Test-only mocks (production preview code is unchanged): pinned core from git, SDK stub, live.medhug.ai API.
  await ctx.route(`https://cdn.jsdelivr.net/gh/jtsgai/medhug-cabin@${PINNED_SHA}/app.js`, (r) =>
    r.fulfill({ status: 200, contentType: "text/javascript", body: pinnedCore }));
  await ctx.route("https://esm.sh/@decartai/sdk", (r) => r.fulfill({ status: 200, contentType: "text/javascript", headers: { "access-control-allow-origin": "*" }, body: STUB_SDK }));
  await ctx.route("https://live.medhug.ai/**", async (r) => {
    const url = r.request().url();
    if (r.request().method() === "OPTIONS") return r.fulfill({ status: 204, headers: cors(r) });
    if (url.endsWith("/api/decart-token")) return r.fulfill({ status: 200, contentType: "application/json", headers: cors(r), body: JSON.stringify({ token: "test-token" }) });
    if (url.endsWith("/api/usage")) { usageHits.push(r.request().postData()); return r.fulfill({ status: 204, headers: cors(r) }); }
    if (url.endsWith("/api/cabin-owner")) return r.fulfill({ status: 200, contentType: "application/json", headers: cors(r), body: JSON.stringify({ used_minutes: 0 }) });
    return r.fulfill({ status: 404, headers: cors(r) });
  });
  if (!stubs) await ctx.unroute("https://esm.sh/@decartai/sdk");
  await page.addInitScript(`
    window.__jtTestCam = ${JSON.stringify(testCam || "")};
    window.__counts = { gum: 0, capture: 0 };
    window.__gumConstraints = [];
    const gum = navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);
    const enu = navigator.mediaDevices.enumerateDevices.bind(navigator.mediaDevices);
    navigator.mediaDevices.enumerateDevices = async () => {
      const real = await enu().catch(() => []);
      if (window.__jtTestCam === "obs") {
        return [{ deviceId: "obs-virtual", kind: "videoinput", label: "OBS Virtual Camera", groupId: "obs" }, ...real];
      }
      return real;
    };
    navigator.mediaDevices.getUserMedia = async (constraints) => {
      window.__counts.gum++;
      try { window.__gumConstraints.push(JSON.parse(JSON.stringify(constraints || {}))); } catch { window.__gumConstraints.push(constraints); }
      if (window.__jtTestCam === "obs") {
        const v = (constraints && constraints.video) || {};
        const w = v.width && (v.width.ideal || v.width);
        const h = v.height && (v.height.ideal || v.height);
        if (w === 1920 && h === 1080) {
          const s = window.__makeSynth(1920, 1080);
          window.__obsSynth = s;
          return s.stream;
        }
      }
      return gum(constraints);
    };
    const cap = HTMLCanvasElement.prototype.captureStream;
    HTMLCanvasElement.prototype.captureStream = function (...a) { if (this.id === "vton-in-canvas") window.__counts.capture++; return cap.apply(this, a); };
  ` + SYNTH);
  await page.goto(`${BASE}/preview-card/${query}`, { waitUntil: "load" });
  await page.waitForFunction(() => document.querySelectorAll("#explore-list .explore-card").length > 0, null, { timeout: 15000 });
  return { ctx, page, errors, usageHits };
}

let main;
try {
  main = await newPage();
  const { page, errors } = main;

  // ---- layout, 2x default
  section("layout: 标准 2× (default)");
  ok((await page.evaluate(() => document.documentElement.getAttribute("data-display-mode"))) === "2", "default data-display-mode is 2");
  ok((await page.evaluate(() => document.documentElement.style.getPropertyValue("--cabin-dpr"))) === "1.5", "--cabin-dpr written from devicePixelRatio (1.5)");
  ok((await page.evaluate(() => document.documentElement.getAttribute("data-dpr"))) === "1.5", "data-dpr=1.5 on <html>");
  let card = await box(page, "#tryon-card");
  ok(near(card.w, 960, 0.5) && near(card.h, 1706.67, 0.5), "2× card is 960×1706.67", JSON.stringify(card));
  ok(card.w < 1440 - 300, "2× card does not fill the 1440px width", `w=${card.w}`);
  ok(near(card.x, 32, 0.5) && near(card.y, 426.67, 0.5), "2× card at x=32, y=426.67", `x=${card.x} y=${card.y}`);
  let rail = await box(page, "#pc-rail-col");
  ok(near(rail.x, 1008, 0.5) && near(rail.w, 400, 0.5), "2× rail is 400px wide at x=1008 (right of card)", JSON.stringify(rail));
  ok(near(rail.h, card.h, 0.5) && near(rail.y, card.y, 0.5), "2× rail has the same height as the card", JSON.stringify(rail));
  ok(near(card.r + 16, rail.x, 0.5) && near(rail.r + 32, 1440, 0.5), "2× horizontal budget 32+960+16+400+32 = 1440");
  ok((await page.$eval("#video-output", (v) => getComputedStyle(v).objectFit)) === "contain", "2× #video-output object-fit: contain");
  ok((await page.$eval("#video-output", (v) => getComputedStyle(v).position)) !== "fixed", "#video-output is not position:fixed");
  const lp = await box(page, "#left-panel");
  ok(lp.x >= card.r, "#left-panel sits to the RIGHT of the card", `lp.x=${lp.x} card.r=${card.r}`);
  const cols = await page.$$eval("#explore-list .explore-card", (cs) => [...new Set(cs.map((c) => Math.round(c.getBoundingClientRect().x)))].length);
  ok(cols === 2, "garment grid has 2 columns", `cols=${cols}`);
  ok((await page.$$eval("#cat-tabs .cat-tab", (t) => t.length)) === 4, "category tabs rendered");
  ok((await page.$$eval("#explore-list img", (imgs) => imgs.every((i) => i.getAttribute("src").startsWith("../assets/")))), "thumb src use ../assets/");
  await page.waitForFunction(() => [...document.images].every((i) => !i.src || i.complete), null, { timeout: 15000 }).catch(() => {});
  const imgs = await page.evaluate(() => { const l = [...document.images].filter((i) => i.getAttribute("src")); return { n: l.filter((i) => i.naturalWidth > 0).length, broken: l.filter((i) => i.complete && i.naturalWidth === 0).map((i) => i.src) }; });
  ok(imgs.n > 0 && imgs.broken.length === 0, "images load (no broken asset paths; lazy ones may be pending)", JSON.stringify(imgs));
  const ctrl = await box(page, "#pc-controls");
  ok(!intersects(ctrl, card), "mode/preset controls do not overlap the card", JSON.stringify({ ctrl, card }));
  const overlap2 = await cardOverlap(page);
  ok(overlap2.n >= 4 && overlap2.overlaps.length === 0, "2× garment cards do not overlap", JSON.stringify(overlap2));
  ok(await page.evaluate(() => window.__jtPreviewPatchReport.every((p) => p.ok) && window.__jtPreviewPatchReport.length >= 15), "all loader patches matched the pinned core");
  const patchReport = await page.evaluate(() => window.__jtPreviewPatchReport);
  const exactCounts = {
    "config-import": 1, "token-inject": 1, "connect-input": 1, "disconnect-usage": 1,
    "skip-empty-key": 1, "end-usage": 1, "toast-reason": 1, "import-config": 0,
    "import-i18n": 1, "assets": 9, "catalog": 1, "layout": 1, "attract-paths": 1,
    "attract-playlist": 1, "applyLayoutVars-noop": 1, "showLocalPreview": 1,
    "attract-initial-mode": 1, "attract-flag": 1, "attract-noop": 1,
    "connect-begin": 1, "onRemoteStream-gen": 1, "connect-assign-gen": 1,
    "timeout-error-text": 1, "connect-catch-invalidate": 1, "race-succeed": 1,
    "confirm-try-guard": 1, "toggle-camera-off": 1,
  };
  for (const [name, count] of Object.entries(exactCounts)) {
    const entry = patchReport.find((p) => p.name === name);
    ok(entry && entry.ok && entry.count === count, `patch ${name} count === ${count}`, JSON.stringify(entry));
  }
  ok((await page.evaluate(() => document.querySelector(".cabin-stage").style.width)) === "", "applyLayoutVars is a no-op (.cabin-stage keeps no inline width)");
  ok(await page.evaluate(() => !document.querySelector('script[src*="force-cam"], link[href*="ui-over-video"]')), "DOM has no force-cam / ui-over-video");
  await page.screenshot({ path: path.join(SHOTS, "preview-2x.png") });

  // ---- synthetic input pipeline
  section("input pipeline with synthetic streams");
  await page.evaluate(async () => {
    window.__s1 = window.__makeSynth(1920, 1080);
    await window.jtPortraitIn(window.__s1.stream);
  });
  const canvasSize = () => page.evaluate(() => { const c = window.__jtVton.getCanvas(); return [c.width, c.height]; });
  ok(JSON.stringify(await canvasSize()) === "[720,1280]", "offscreen vton canvas is 720×1280");
  await page.waitForFunction(() => window.__jtVtonStatus && window.__jtVtonStatus.videoWidth === 1920, null, { timeout: 8000 });
  let st = await page.evaluate(() => window.__jtVtonStatus);
  ok(st.status === "obs-contain" && st.reason === "preset-hit" && st.label === "预设已命中", "1920×1080 + ON -> 预设已命中", JSON.stringify(st));
  ok((await page.textContent("#obs-preset-status")) === "预设已命中", "UI badge shows 预设已命中");
  ok(st.fps === 20, "default fps is 20", String(st.fps));
  const px = (x, y) => page.evaluate(([x, y]) => { window.__jtVton.drawNow(); const d = window.__jtVton.getCanvas().getContext("2d").getImageData(x, y, 1, 1).data; return [d[0], d[1], d[2]]; }, [x, y]);
  let top = await px(360, 20), mid = await px(360, 1100), centre = await px(300, 700);
  ok(top[0] < 60 && top[1] < 90 && top[2] < 60, "OBS contain: top padding is dark (not source red / bright)", JSON.stringify(top));
  ok(mid[1] > 100 && mid[0] < 80, "OBS contain: ROI content (green) drawn inside the canvas", JSON.stringify(mid));
  ok(await page.evaluate(() => window.__jtVtonIn === window.__jtVton.getStream() && !!window.__jtVtonIn), "window.__jtVtonIn is the canvas stream");
  const trackInfo = () => page.evaluate(() => { const t = window.__jtVtonIn.getVideoTracks()[0]; const s = t.getSettings(); return { id: t.id, w: s.width, h: s.height, state: t.readyState }; });
  const t0 = await trackInfo();
  ok(t0.state === "live" && (t0.w === 720 || t0.w === undefined) && (t0.h === 1280 || t0.h === undefined), "canvas track settings 720×1280", JSON.stringify(t0));
  await page.evaluate(() => { const v = document.getElementById("video-output"); v.srcObject = window.__jtVtonIn; });
  await sleep(400);
  await page.screenshot({ path: path.join(SHOTS, "preview-2x-obs-contain.png") });

  // toggle OFF
  await page.click("#obs-preset-toggle");
  st = await page.evaluate(() => window.__jtVtonStatus);
  ok(st.reason === "preset-off" && st.status === "generic-cover", "toggle OFF -> generic cover / preset-off", JSON.stringify(st));
  ok((await page.textContent("#obs-preset-status")) === "预设已关闭", "UI badge shows 预设已关闭");
  top = await px(360, 20);
  ok(top[1] > 100 && top[0] < 80, "preset OFF: top row now source content (generic cover, no padding)", JSON.stringify(top));
  ok(near(st.src.sx, 656.25) && near(st.src.sw, 607.5), "preset OFF at 1920×1080 uses sx=656.25 sw=607.5", JSON.stringify(st.src));
  await page.click("#obs-preset-toggle");
  st = await page.evaluate(() => window.__jtVtonStatus);
  ok(st.reason === "preset-hit", "toggle ON again -> preset-hit");

  // same stream changes size (no re-feed): ROI must not stay cached
  await page.evaluate(() => { window.__s1.canvas.width = 1280; window.__s1.canvas.height = 720; });
  await page.waitForFunction(() => window.__jtVtonStatus.videoWidth === 1280, null, { timeout: 8000 }).catch(() => {});
  st = await page.evaluate(() => window.__jtVtonStatus);
  ok(st.videoWidth === 1280 && st.reason === "preset-miss" && st.status === "generic-cover", "track resized to 1280×720 -> 预设未命中 (ROI not cached)", JSON.stringify(st));
  ok((await page.textContent("#obs-preset-status")) === "预设未命中", "UI badge shows 预设未命中");
  ok(near(st.src.sx, 437.5) && near(st.src.sw, 405), "1280×720 live path: sx=437.5 sw=405", JSON.stringify(st.src));
  await page.evaluate(() => { window.__s1.canvas.width = 1920; window.__s1.canvas.height = 1080; });
  await page.waitForFunction(() => window.__jtVtonStatus.videoWidth === 1920, null, { timeout: 8000 }).catch(() => {});
  st = await page.evaluate(() => window.__jtVtonStatus);
  ok(st.reason === "preset-hit", "track back to 1920×1080 -> 预设已命中 again", JSON.stringify(st));
  await page.evaluate(async () => { window.__s1.stop(); window.__s2 = window.__makeSynth(720, 1280); await window.jtPortraitIn(window.__s2.stream); });
  await page.waitForFunction(() => window.__jtVtonStatus.videoWidth === 720, null, { timeout: 8000 });
  st = await page.evaluate(() => window.__jtVtonStatus);
  ok(st.reason === "preset-miss" && st.src.sx === 0 && st.src.sw === 720 && st.src.sh === 1280, "720×1280 source -> generic, full frame", JSON.stringify(st.src));
  const t1 = await trackInfo();
  ok(t1.id === t0.id, "canvas track is reused across jtPortraitIn calls (no new stream)");
  await page.evaluate(async () => { window.__s2.stop(); window.__s3 = window.__makeSynth(1920, 1080); await window.jtPortraitIn(window.__s3.stream); });
  await page.waitForFunction(() => window.__jtVtonStatus.videoWidth === 1920, null, { timeout: 8000 });

  // ---- display mode switching: CSS only
  section("display modes are CSS-only");
  const before = { ...(await trackInfo()), counts: await page.evaluate(() => ({ ...window.__counts })), canvas: await canvasSize() };
  await page.click('[data-mode-btn="1"]');
  card = await box(page, "#tryon-card"); rail = await box(page, "#pc-rail-col");
  ok(near(card.w, 480, 0.5) && near(card.h, 853.33, 0.5), "清晰 1× card is 480×853.33", JSON.stringify(card));
  ok(near(card.x, 80, 0.5) && near(card.y, 853.33, 0.5), "1× card at x=80,y=853.33");
  ok(near(rail.x, 600, 0.5) && near(rail.w, 800, 0.5), "1× rail 800px wide at x=600", JSON.stringify(rail));
  ok((await page.$eval("#video-output", (v) => getComputedStyle(v).objectFit)) === "contain", "1× #video-output object-fit: contain");
  ok((await page.getAttribute('[data-mode-btn="1"]', "aria-pressed")) === "true" && (await page.getAttribute('[data-mode-btn="2"]', "aria-pressed")) === "false", "1× button marked aria-pressed");
  await page.waitForFunction(() => [...document.querySelectorAll("#explore-list img")].every((i) => i.complete), null, { timeout: 8000 }).catch(() => {});
  await sleep(200);
  const overlap1 = await cardOverlap(page);
  ok(overlap1.n >= 4 && overlap1.overlaps.length === 0, "1× garment cards do not overlap", JSON.stringify(overlap1));
  await page.screenshot({ path: path.join(SHOTS, "preview-1x.png") });
  await page.click('[data-mode-btn="full"]');
  card = await box(page, "#tryon-card");
  ok(near(card.x, 0) && near(card.y, 0) && near(card.w, 1440, 0.5) && near(card.h, 2560, 0.5), "全屏对照 card covers the viewport 1440×2560", JSON.stringify(card));
  ok((await page.$eval("#video-output", (v) => getComputedStyle(v).objectFit)) === "cover", "全屏对照 #video-output object-fit: cover");
  ok(await page.evaluate(() => document.documentElement.classList.contains("is-fullscreen-compare")), "is-fullscreen-compare class set");
  const ctl = await box(page, "#pc-controls");
  ok(ctl.x >= 0 && ctl.r <= 1440 && ctl.y >= 0, "全屏对照 switcher stays reachable inside the viewport");
  const fRail = await box(page, "#pc-rail-col");
  ok(fRail.x >= 1440 - 160 && fRail.r <= 1440.5, "全屏对照 rail is a slim right-edge strip (≤160px)", JSON.stringify(fRail));
  ok(await page.evaluate(() => { const b = document.getElementById("btn-cam-toggle").getBoundingClientRect(); return b.width > 0 && b.right <= innerWidth && b.bottom <= innerHeight; }), "全屏对照 camera button reachable");
  await page.screenshot({ path: path.join(SHOTS, "preview-full.png") });
  await page.click('[data-mode-btn="2"]');
  card = await box(page, "#tryon-card");
  ok(near(card.w, 960, 0.5) && near(card.h, 1706.67, 0.5), "back to 2×: 960×1706.67");
  const after = { ...(await trackInfo()), counts: await page.evaluate(() => ({ ...window.__counts })), canvas: await canvasSize() };
  ok(before.id === after.id && before.state === after.state, "mode switching kept the same canvas track", JSON.stringify({ before, after }));
  ok(JSON.stringify(before.canvas) === "[720,1280]" && JSON.stringify(after.canvas) === "[720,1280]", "canvas stays 720×1280 through 1×/全屏/2×");
  ok(before.counts.gum === after.counts.gum && before.counts.capture === after.counts.capture, "no getUserMedia / captureStream calls during mode switches", JSON.stringify({ b: before.counts, a: after.counts }));
  ok(after.counts.capture === 1, "captureStream was created exactly once", String(after.counts.capture));
  await page.evaluate(() => window.__s3.stop());

  // ---- camera gate + try-on flow with fake camera and stubbed Decart
  section("gated camera + try-on flow (fake device, stubbed Decart/live API)");
  const flow = await newPage();
  const fp = flow.page;
  ok(await fp.evaluate(() => window.__jtAllowCam === false && !window.__jtVtonIn), "camera gated before any click; no canvas stream yet");
  await fp.click("#explore-list .explore-card");
  ok(await fp.evaluate(() => !document.getElementById("product-modal").classList.contains("hidden")), "product modal opens on thumb tap");
  await fp.screenshot({ path: path.join(SHOTS, "preview-modal.png") });
  ok((await fp.textContent("#btn-modal-cancel")).length > 0 && (await fp.textContent("#btn-modal-shortlist")).length > 0 && (await fp.textContent("#btn-modal-try")).length > 0, "modal has 返回 / 加入备选 / 试穿");
  await fp.click("#btn-modal-try");
  await fp.waitForFunction(() => window.__stub && window.__stub.calls && window.__stub.calls.length > 0, null, { timeout: 20000 });
  const sres = await fp.evaluate(() => ({
    key: window.__stub.apiKey,
    sameStream: window.__stub.connectStream === window.__jtVtonIn,
    notRaw: window.__stub.connectStream !== window.__jtRawStream,
    opts: window.__stub.connectOpts,
    call: window.__stub.calls[0],
    outIsRemote: document.getElementById("video-output").srcObject === window.__stub.remote,
    outIsRaw: document.getElementById("video-output").srcObject === window.__jtRawStream,
    collapsed: document.getElementById("left-panel").classList.contains("collapsed"),
    gum: window.__counts.gum,
  }));
  ok(sres.key === "test-token", "Decart client created with the freshly fetched token");
  ok(sres.sameStream && sres.notRaw, "connect() received window.__jtVtonIn (the 720×1280 canvas stream), not the raw camera stream");
  ok(sres.opts.model === "lucy-vton-latest" && sres.opts.mirror === "auto" && sres.opts.hasOnRemote, "connect options: lucy-vton-latest, mirror auto, onRemoteStream", JSON.stringify(sres.opts));
  ok(sres.call.enhance === false && /^product_/.test(sres.call.image) && sres.call.prompt.length > 10, "set({prompt,image,enhance:false}) called", JSON.stringify(sres.call));
  ok(sres.outIsRemote && !sres.outIsRaw, "#video-output shows the remote stream, never the raw camera stream");
  ok(sres.collapsed && sres.gum >= 1, "rail collapsed after try-on; camera was requested only after the click");
  const flowCons = await fp.evaluate(() => { const last = (window.__gumConstraints || []).slice(-1)[0] || {}; return last.video || last; });
  ok(flowCons.width && flowCons.width.ideal === 720 && flowCons.height.ideal === 1280 && flowCons.aspectRatio && Math.abs(flowCons.aspectRatio.ideal - 9 / 16) < 1e-6, "non-OBS getUserMedia keeps 720×1280 and aspectRatio 9/16", JSON.stringify(flowCons));
  const camInfo = await fp.evaluate(() => { const t = window.__jtRawStream.getVideoTracks()[0].getSettings(); return { w: t.width, h: t.height, status: window.__jtVtonStatus }; });
  ok(camInfo.status.videoWidth === camInfo.w && camInfo.status.reason !== "preset-hit", `fake camera ${camInfo.w}×${camInfo.h} measured -> ${camInfo.status.label}, no OBS ROI`, JSON.stringify(camInfo.status));
  const sel = await fp.evaluate(() => {
    const out = document.getElementById("video-output");
    return { vw: out.videoWidth, vh: out.videoHeight, local: window.__jtVtonIn === window.__jtVton.getStream() };
  });
  ok(sel.vw === 720 && sel.vh === 1280, "#video-output decodes 720×1280", JSON.stringify(sel));

  // collapsed rail geometry
  await sleep(300);
  const ccard = await box(fp, "#tryon-card");
  const crail = await box(fp, "#left-panel");
  ok(!intersects(ccard, crail) && crail.x >= ccard.r - 0.5, "collapsed rail does not overlap the card (never a left-edge overlay on the face)", JSON.stringify({ ccard, crail }));
  ok(crail.w <= 200 && crail.r <= 1440 - 31, "collapsed rail is a slim column on the right", JSON.stringify(crail));
  const endVis = await fp.$eval("#btn-end", (b) => { const r = b.getBoundingClientRect(); return { disp: getComputedStyle(b).display, w: r.width, x: r.x, y: r.y, r: r.right, b: r.bottom }; });
  ok(endVis.disp !== "none" && endVis.w > 0 && !intersects({ x: endVis.x, y: endVis.y, r: endVis.r, b: endVis.b }, ccard), "结束 button visible during try-on, outside the card", JSON.stringify(endVis));
  const camBtn = await box(fp, "#btn-cam-toggle");
  ok(camBtn.w > 0 && !intersects(camBtn, ccard), "摄像头 button visible, outside the card");
  await fp.waitForFunction(() => document.getElementById("rail-current-name").textContent.trim() !== "—", null, { timeout: 5000 }).catch(() => {});
  ok((await fp.textContent("#rail-current-name")).trim() !== "—", "current garment name shown", JSON.stringify(await fp.evaluate(() => ({ status: document.getElementById("status").textContent, cls: document.getElementById("status").className, name: document.getElementById("rail-current-name").textContent }))));
  const railCur = await fp.evaluate(() => {
    const el = document.getElementById("rail-current");
    const st = getComputedStyle(el);
    const r = el.getBoundingClientRect();
    return { display: st.display, visibility: st.visibility, opacity: st.opacity, w: r.width, h: r.height, x: r.x, y: r.y, r: r.right, b: r.bottom };
  });
  ok(railCur.display !== "none" && railCur.visibility !== "hidden" && Number(railCur.opacity) !== 0 && railCur.w > 0 && railCur.h > 0, ".rail-current is visible during try-on (not just textContent)", JSON.stringify(railCur));
  ok(!intersects(railCur, ccard), ".rail-current does not overlap the try-on card", JSON.stringify({ railCur, ccard }));
  await fp.screenshot({ path: path.join(SHOTS, "preview-2x-tryon.png") });

  // 15s emphasis and end
  const glowed = await fp.waitForFunction(() => document.getElementById("btn-end").classList.contains("glow") || document.getElementById("btn-end").classList.contains("boost"), null, { timeout: 20000 }).then(() => true).catch(() => false);
  ok(glowed, "结束 emphasis (glow/boost) appears after ~15s of live try-on");
  await fp.click("#btn-end");
  await fp.waitForFunction(() => !document.getElementById("end-overlay").classList.contains("hidden"));
  await sleep(500);
  ok(flow.usageHits.length >= 1 && /"feature":"tryon"/.test(flow.usageHits[0] || ""), "UsageClient start(tryon)…stop(tryon) reported a tryon usage on End", JSON.stringify(flow.usageHits));
  ok(await fp.evaluate(() => !document.getElementById("end-overlay").classList.contains("hidden")), "end overlay shown after 结束");
  await fp.screenshot({ path: path.join(SHOTS, "preview-end-overlay.png") });
  await flow.ctx.close();

  // ---- real cam-gate path for an OBS-labelled 1920×1080 device
  section("cam-gate OBS 1920×1080 constraints + track badge");
  const obsFlow = await newPage("?owner=0", { testCam: "obs" });
  const op = obsFlow.page;
  await op.click("#explore-list .explore-card");
  await op.click("#btn-modal-try");
  await op.waitForFunction(() => (window.__gumConstraints || []).length > 0, null, { timeout: 15000 });
  const obsCons = await op.evaluate(() => { const last = (window.__gumConstraints || []).slice(-1)[0] || {}; return last.video || last; });
  ok(obsCons.width && obsCons.width.ideal === 1920 && obsCons.height && obsCons.height.ideal === 1080, "OBS getUserMedia width.ideal 1920 and height.ideal 1080", JSON.stringify(obsCons));
  ok(obsCons.resizeMode === "none", "OBS getUserMedia resizeMode is none", JSON.stringify(obsCons));
  ok(obsCons.aspectRatio === undefined, "OBS getUserMedia has no aspectRatio 9/16", JSON.stringify(obsCons));
  await op.waitForFunction(() => window.__jtVtonStatus && window.__jtVtonStatus.reason === "preset-hit", null, { timeout: 10000 });
  const obsBadge = ((await op.textContent("#obs-preset-status")) || "") + " " + ((await op.textContent("#obs-preset-detail")) || "");
  ok(obsBadge.includes("预设已命中"), "OBS badge shows 预设已命中", obsBadge);
  ok(/track\s*1920\s*[×x]\s*1080/.test(obsBadge), "badge/detail shows track 1920×1080", obsBadge);
  await obsFlow.ctx.close();

  // ---- late connect after timeout is discarded; error is 连接超时 not 额度不足
  section("late connect cancelled + timeout vs credit");
  const late = await newPage("?owner=0");
  await late.page.evaluate(() => { window.__jtConnectTimeoutMs = 800; window.__stubConnectDelay = 2500; });
  await late.page.click("#explore-list .explore-card");
  await late.page.click("#btn-modal-try");
  await late.page.waitForFunction(() => {
    const r = document.getElementById("tryon-reason");
    return r && !r.classList.contains("hidden") && r.textContent.trim().length > 0;
  }, null, { timeout: 8000 });
  const reasonText = (await late.page.textContent("#tryon-reason")) || "";
  ok(/连接超时/.test(reasonText) && !/额度不足/.test(reasonText), "timeout is reported as 连接超时, not 额度不足", reasonText);
  await sleep(2800);
  const lateState = await late.page.evaluate(() => ({
    started: window.__stub && window.__stub.connectStarted || 0,
    disconnected: window.__stub && window.__stub.disconnected || 0,
    outIsRemote: document.getElementById("video-output").srcObject === (window.__stub && window.__stub.remote),
    live: window.__jtTryonLive,
    connecting: window.__jtConn && window.__jtConn.connecting,
  }));
  ok(lateState.started >= 1 && lateState.disconnected >= 1, "late connect() was started and then disconnect()ed", JSON.stringify(lateState));
  ok(!lateState.outIsRemote && !lateState.live && !lateState.connecting, "late remote stream was not attached and try-on is not live", JSON.stringify(lateState));
  ok(late.usageHits.length === 0, "late connect did not start usage", JSON.stringify(late.usageHits));
  await late.ctx.close();

  // ---- camera off stops the try-on usage timer and clears stale vton status
  section("camera off stops UsageClient and clears vton status");
  const camPage = await newPage("?owner=0");
  const cp = camPage.page;
  await cp.click("#explore-list .explore-card");
  await cp.click("#btn-modal-try");
  await cp.waitForFunction(() => window.__jtTryonLive === true, null, { timeout: 20000 });
  const usageBefore = camPage.usageHits.length;
  await cp.click("#btn-cam-toggle");
  await sleep(500);
  ok(camPage.usageHits.length > usageBefore && camPage.usageHits.some((b) => /"feature":"tryon"/.test(b || "")), "camera off posts UsageClient.stop(tryon)", JSON.stringify(camPage.usageHits));
  ok(await cp.evaluate(() => window.__jtTryonLive === false), "camera off clears __jtTryonLive");
  const afterOff = await cp.evaluate(() => window.__jtVtonStatus);
  ok(!afterOff || afterOff.reason === "no-video" || afterOff.videoWidth === 0, "camera off status is 等待画面 / no-video, not a stale miss", JSON.stringify(afterOff));
  ok(((await cp.textContent("#obs-preset-status")) || "").includes("等待画面") || (afterOff && afterOff.reason === "no-video"), "badge shows 等待画面 after camera off");
  await camPage.ctx.close();

  // ---- console cleanliness (main page + flow page)
  section("console");
  const allErrors = [...errors, ...flow.errors, ...obsFlow.errors, ...late.errors, ...camPage.errors];
  const unexpected = allErrors.filter((e) => !/live\.medhug\.ai|esm\.sh|Failed to load resource.*(net::ERR|404)/.test(e));
  ok(unexpected.length === 0, "zero console errors / pageerrors (expected mocked-network noise filtered)", unexpected.slice(0, 5).join(" | "));
  if (allErrors.length) console.log(`  (filtered ${allErrors.length - unexpected.length} expected network errors)`);
  await main.ctx.close();
} catch (e) {
  failures++;
  console.log(`FAIL  harness exception -> ${e.stack || e}`);
} finally {
  await browser.close().catch(() => {});
  server.kill();
}
console.log(`\nscreenshots: ${SHOTS}`);
finish();

function finish() {
  console.log(`\n${passes} passed, ${failures} failed`);
  process.exit(failures ? 1 : 0);
}
