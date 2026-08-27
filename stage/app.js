import * as THREE from "https://esm.sh/three@0.167.1";

const canvas = document.querySelector("#stage");
const hint = document.querySelector("#hint");
const CHARACTERS = [
  { id: "cutea", name: "Cutea", file: "Cutea.png", role: "host", home: { x: 0, y: 0.12, z: 0, s: 2.8 }, greet: { x: 0, y: 0.18, z: 1.4, s: 3.3 } },
  { id: "filo", name: "Filo", file: "Filo.png", role: "play", home: { x: 1.15, y: 0.02, z: -0.55, s: 2.15 }, greet: { x: 0, y: 0.16, z: 1.4, s: 3.2 } },
  { id: "halo", name: "Halo", file: "Halo.png", role: "magic", home: { x: -0.85, y: 1.05, z: -0.2, s: 1.55 }, greet: { x: 0, y: 0.55, z: 1.5, s: 2.4 } }
];

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x000000);
const camera = new THREE.PerspectiveCamera(32, 1, 0.1, 50);
camera.position.set(0, 1.15, 6.2);
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false });
renderer.setClearColor(0x000000, 1);
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
const key = new THREE.DirectionalLight(0xffffff, 1.15);
key.position.set(0.5, 2.4, 4);
scene.add(key);
scene.add(new THREE.AmbientLight(0xffffff, 0.5));

const actors = [];
let selected = "cutea";
let state = "idle";
let presence = false;
let presentSince = 0;
let absentSince = 0;
let lastFaceCheck = 0;
let going = false;
const clock = new THREE.Clock();
const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();

function resize() {
  const w = window.innerWidth, h = window.innerHeight;
  camera.aspect = w / h; camera.updateProjectionMatrix(); renderer.setSize(w, h, false);
}
window.addEventListener("resize", resize); resize();

function loadSprite(url) {
  return new Promise((resolve, reject) => {
    new THREE.TextureLoader().load(url, (tex) => {
      tex.colorSpace = THREE.SRGBColorSpace;
      resolve(new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false })));
    }, undefined, reject);
  });
}

async function boot() {
  for (const spec of CHARACTERS) {
    try {
      const sprite = await loadSprite(`../kids/assets/${spec.file}`);
      const img = sprite.material.map.image;
      const ratio = img && img.width && img.height ? img.width / img.height : 0.75;
      sprite.userData = { spec, ratio };
      sprite.position.set(spec.home.x, spec.home.y, spec.home.z);
      sprite.scale.set(ratio * spec.home.s, spec.home.s, 1);
      scene.add(sprite); actors.push(sprite);
    } catch (_) { hint.textContent = `Missing ${spec.file}`; }
  }
  hint.textContent = "Cutea, Filo and Halo are on stage";
}

async function detectPerson() {
  const now = performance.now();
  if (now - lastFaceCheck < 350) return presence;
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
  } catch (_) { hint.textContent = "Tap a friend to come forward"; }
}

function pickActor(ev) {
  const rect = canvas.getBoundingClientRect();
  pointer.x = ((ev.clientX - rect.left) / rect.width) * 2 - 1;
  pointer.y = -((ev.clientY - rect.top) / rect.height) * 2 + 1;
  raycaster.setFromCamera(pointer, camera);
  const hits = raycaster.intersectObjects(actors);
  return hits[0] && hits[0].object;
}

function goKids(id) {
  if (going) return; going = true;
  hint.textContent = `${CHARACTERS.find((c) => c.id === id).name} will perform`;
  setTimeout(() => { window.location.href = `../kids/?char=${id}`; }, 1400);
}

canvas.addEventListener("pointerdown", (ev) => {
  const hit = pickActor(ev); if (!hit) return;
  const id = hit.userData.spec.id;
  if (selected === id && state === "greet") { goKids(id); return; }
  selected = id; state = "greet";
  hint.textContent = `${hit.userData.spec.name} comes forward — tap again to perform`;
});

function targetFor(actor) {
  const spec = actor.userData.spec;
  const isSel = spec.id === selected && state === "greet";
  const src = isSel ? spec.greet : spec.home;
  const dim = !isSel && state === "greet" ? 0.55 : 1;
  return { x: src.x, y: src.y, z: src.z, s: src.s * (isSel ? 1 : dim > 0.9 ? 1 : 0.78), dim };
}

function tick() {
  requestAnimationFrame(tick);
  const t = clock.getElapsedTime(); const now = performance.now();
  detectPerson().then((seen) => {
    if (going) return;
    if (seen) {
      absentSince = 0; if (!presence) presentSince = now; presence = true;
      if (state === "idle" && now - presentSince > 2200) {
        state = "greet"; selected = "cutea";
        hint.textContent = "Cutea sees you — tap Filo or Halo to switch";
      }
    } else {
      if (!absentSince) absentSince = now;
      if (now - absentSince > 5000) {
        presence = false; presentSince = 0; state = "idle"; selected = "cutea";
        hint.textContent = "Cutea, Filo and Halo are on stage";
      }
    }
  });
  for (const actor of actors) {
    const spec = actor.userData.spec; const tgt = targetFor(actor);
    const bob = spec.role === "magic" ? Math.sin(t * 2.2) * 0.08 : spec.role === "play" ? Math.sin(t * 1.8) * 0.05 : Math.sin(t * 1.5) * 0.05;
    const sway = spec.role === "play" ? Math.sin(t * 1.1) * 0.06 : Math.sin(t * 0.8) * 0.03;
    actor.position.x += (tgt.x + sway - actor.position.x) * 0.07;
    actor.position.y += (tgt.y + bob - actor.position.y) * 0.07;
    actor.position.z += (tgt.z - actor.position.z) * 0.07;
    const s = actor.scale.y + (tgt.s - actor.scale.y) * 0.07;
    actor.scale.set(actor.userData.ratio * s, s, 1);
    actor.material.rotation = spec.role === "magic" ? Math.sin(t * 3) * 0.08 : (state === "greet" && spec.id === selected ? Math.sin(t * 6) * 0.05 : Math.sin(t * 1.1) * 0.02);
    actor.material.opacity = 0.45 + tgt.dim * 0.55;
  }
  renderer.render(scene, camera);
}
boot().then(startPresenceCam);
tick();
