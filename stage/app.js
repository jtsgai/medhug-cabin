import * as THREE from "https://esm.sh/three@0.167.1";

const canvas = document.querySelector("#stage");
const hint = document.querySelector("#hint");
const play = document.querySelector("#btn-play");

const SPECS = [
  { id: "cutea", name: "Cutea", img: "../kids/assets/Cutea.png", home: { x: 0, z: 0.25 }, lean: { x: 0, z: 0.72 }, front: { x: 0, z: 1.05 }, scale: 1.18, line: "Hi, I'm Cutea. Tap play and we can perform." },
  { id: "halo", name: "Halo", img: "../kids/assets/Halo.png", home: { x: -0.72, z: -0.45 }, lean: { x: -0.42, z: 0.35 }, front: { x: 0, z: 1.05 }, scale: 0.92, line: "Hi, I'm Halo. Tap play and we can perform." },
  { id: "filo", name: "Filo", img: "../kids/assets/Filo.png", home: { x: 0.72, z: -0.4 }, lean: { x: 0.42, z: 0.35 }, front: { x: 0, z: 1.05 }, scale: 0.94, line: "Hi, I'm Filo. Tap play and we can perform." }
];

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(34, 9 / 16, 0.1, 80);
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
renderer.setClearColor(0x000000, 0);
renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2));
scene.add(new THREE.AmbientLight(0xffffff, 1.15));

const actors = [];
let selected = null;
let state = "idle";
let presence = false;
let presentSince = 0;
let absentSince = 0;
let lastFaceCheck = 0;
let billing = false;
let going = false;
const clock = new THREE.Clock();
const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();
const loader = new THREE.TextureLoader();

function setHint(text) {
  hint.textContent = text || "";
  hint.classList.toggle("hidden", !text);
}
function setPlay(show) {
  play.classList.toggle("hidden", !show);
}
function speak(text) {
  try {
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = "en-US";
    u.rate = 0.95;
    window.speechSynthesis.speak(u);
  } catch (_) {}
}
function setBilling(on) {
  if (on && !billing) {
    window.UsageClient?.start("stage");
    billing = true;
  } else if (!on && billing) {
    window.UsageClient?.stop("stage");
    billing = false;
  }
}
function frameCabin() {
  const w = canvas.clientWidth || innerWidth;
  const h = canvas.clientHeight || innerHeight;
  camera.aspect = w / Math.max(h, 1);
  camera.position.set(0, 1.35, 6.4);
  camera.lookAt(0, 0.38, 0);
  camera.updateProjectionMatrix();
  renderer.setSize(w, h, false);
}
addEventListener("resize", frameCabin);
frameCabin();

function softShadowTexture() {
  const c = document.createElement("canvas");
  c.width = 256; c.height = 256;
  const g = c.getContext("2d");
  const grd = g.createRadialGradient(128, 128, 6, 128, 128, 126);
  grd.addColorStop(0, "rgba(0,0,0,0.2)");
  grd.addColorStop(0.3, "rgba(0,0,0,0.08)");
  grd.addColorStop(1, "rgba(0,0,0,0)");
  g.fillStyle = grd; g.fillRect(0, 0, 256, 256);
  return new THREE.CanvasTexture(c);
}
const SHADOW_TEX = softShadowTexture();

function makeCharacter(spec, texture) {
  texture.colorSpace = THREE.SRGBColorSpace;
  const img = texture.image;
  const aspect = img?.width && img?.height ? img.width / img.height : 0.72;
  const h = spec.scale;
  const w = h * aspect;
  const mat = new THREE.MeshBasicMaterial({ map: texture, transparent: true, alphaTest: 0.1, side: THREE.DoubleSide, depthWrite: false });
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat);
  mesh.position.y = h / 2;
  const shadow = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: SHADOW_TEX, transparent: true, depthWrite: false, opacity: 0.65 }));
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.set(0.02, 0.008, 0.05);
  shadow.scale.set(w * 0.5, 1, w * 0.2);
  const root = new THREE.Group();
  root.add(shadow); root.add(mesh);
  root.userData = { spec, body: mesh, shadow, baseH: h, shadowW: w };
  return root;
}
function loadTex(url) {
  return new Promise((resolve, reject) => loader.load(url, resolve, undefined, reject));
}
async function boot() {
  setHint("");
  setPlay(false);
  for (const spec of SPECS) {
    try {
      const tex = await loadTex(spec.img);
      const root = makeCharacter(spec, tex);
      root.position.set(spec.home.x, 0, spec.home.z);
      scene.add(root); actors.push(root);
    } catch (e) { console.warn("tex", spec.id, e); }
  }
  frameCabin();
}

async function detectPerson() {
  const now = performance.now();
  if (now - lastFaceCheck < 400) return presence;
  lastFaceCheck = now;
  if (!window.FaceDetector || !detectPerson.video) return presence;
  try {
    const det = new FaceDetector({ fastMode: true, maxDetectedFaces: 1 });
    const snap = document.createElement("canvas"); snap.width = 160; snap.height = 90;
    const v = detectPerson.video; if (!v.videoWidth) return presence;
    snap.getContext("2d").drawImage(v, 0, 0, 160, 90);
    return (await det.detect(snap)).length > 0;
  } catch (_) { return presence; }
}
async function startPresenceCam() {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: false, video: { facingMode: "user", width: { ideal: 320 }, height: { ideal: 240 } } });
    const video = document.createElement("video"); video.playsInline = true; video.muted = true; video.srcObject = stream;
    await video.play().catch(() => {}); detectPerson.video = video;
  } catch (_) {}
}
function pickActor(ev) {
  const r = canvas.getBoundingClientRect();
  pointer.x = ((ev.clientX - r.left) / r.width) * 2 - 1;
  pointer.y = -((ev.clientY - r.top) / r.height) * 2 + 1;
  raycaster.setFromCamera(pointer, camera);
  const hits = raycaster.intersectObjects(actors, true);
  if (!hits.length) return null;
  let o = hits[0].object; while (o && !o.userData.spec) o = o.parent; return o;
}
function choose(id) {
  const spec = SPECS.find((s) => s.id === id);
  if (!spec) return;
  selected = id;
  state = "chosen";
  setHint(spec.name);
  setPlay(true);
  speak(spec.line);
}
function goKids() {
  if (!selected || going) return;
  going = true;
  setBilling(false);
  setHint("Let's go");
  setTimeout(() => { location.href = `../kids/?char=${selected}`; }, 700);
}
canvas.addEventListener("pointerdown", (ev) => {
  const hit = pickActor(ev);
  if (!hit) return;
  const id = hit.userData.spec.id;
  if (selected === id && state === "chosen") { goKids(); return; }
  choose(id);
});
play.addEventListener("click", goKids);

function tick() {
  requestAnimationFrame(tick);
  const t = clock.elapsedTime; const now = performance.now();
  detectPerson().then((seen) => {
    if (going) return;
    if (seen) {
      absentSince = 0;
      if (!presence) presentSince = now;
      presence = true;
      setBilling(true);
      if (state === "idle" && now - presentSince > 1500) {
        state = "greet";
        setHint("Tap a friend");
      }
    } else {
      if (!absentSince) absentSince = now;
      if (now - absentSince > 8000) {
        presence = false;
        presentSince = 0;
        state = "idle";
        selected = null;
        setHint("");
        setPlay(false);
        setBilling(false);
      }
    }
  });
  for (const actor of actors) {
    const spec = actor.userData.spec;
    const chosen = state === "chosen" && spec.id === selected;
    const tgt = chosen ? spec.front : state === "greet" || state === "chosen" ? spec.lean : spec.home;
    actor.position.x += (tgt.x - actor.position.x) * 0.07;
    actor.position.z += (tgt.z - actor.position.z) * 0.07;
    const bounce = Math.sin(t * (chosen ? 5.2 : 2.2) + spec.scale) * (chosen ? 0.05 : 0.022);
    actor.userData.body.position.y = actor.userData.baseH / 2 + bounce;
    actor.userData.body.rotation.z = Math.sin(t * (chosen ? 4.4 : 1.25)) * (chosen ? 0.08 : 0.02);
    const s = 1 + bounce * 0.08;
    actor.userData.shadow.scale.set(actor.userData.shadowW * 0.5 * s, 1, actor.userData.shadowW * 0.2 * s);
  }
  renderer.render(scene, camera);
}
boot().then(startPresenceCam);
tick();
window.addEventListener("beforeunload", () => setBilling(false));
