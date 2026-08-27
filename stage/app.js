import * as THREE from "https://esm.sh/three@0.167.1";

const canvas = document.querySelector("#stage");
const hint = document.querySelector("#hint");

const SPECS = [
  { id: "cutea", name: "Cutea", img: "../kids/assets/Cutea.png", home: { x: 0, z: 0.55 }, greet: { x: 0, z: 1.15 }, scale: 1.95 },
  { id: "halo", name: "Halo", img: "../kids/assets/Halo.png", home: { x: -1.05, z: -0.35 }, greet: { x: -0.15, z: 1.05 }, scale: 1.55 },
  { id: "filo", name: "Filo", img: "../kids/assets/Filo.png", home: { x: 1.05, z: -0.3 }, greet: { x: 0.15, z: 1.05 }, scale: 1.58 }
];

const scene = new THREE.Scene();
scene.background = null;

const camera = new THREE.PerspectiveCamera(24, 1, 0.1, 80);
camera.position.set(0, 1.62, 8.8);
camera.lookAt(0, 0.78, 0);

const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
renderer.setClearColor(0x000000, 0);
renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2));
scene.add(new THREE.AmbientLight(0xffffff, 1.2));

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
const loader = new THREE.TextureLoader();

function resize() {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight, false);
}
addEventListener("resize", resize);
resize();

function makeCharacter(spec, texture) {
  texture.colorSpace = THREE.SRGBColorSpace;
  const img = texture.image;
  const aspect = img?.width && img?.height ? img.width / img.height : 0.72;
  const h = spec.scale;
  const w = h * aspect;
  const mat = new THREE.MeshBasicMaterial({
    map: texture, transparent: true, alphaTest: 0.12,
    side: THREE.DoubleSide, depthWrite: false
  });
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat);
  mesh.position.y = h / 2;
  const shadow = new THREE.Mesh(
    new THREE.CircleGeometry(w * 0.26, 28),
    new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.26, depthWrite: false })
  );
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.y = 0.02;
  const root = new THREE.Group();
  root.add(mesh); root.add(shadow);
  root.userData = { spec, body: mesh, shadow, baseH: h };
  return root;
}

function loadTex(url) {
  return new Promise((resolve, reject) => loader.load(url, resolve, undefined, reject));
}

async function boot() {
  hint.textContent = "Friends on stage";
  for (const spec of SPECS) {
    try {
      const tex = await loadTex(spec.img);
      const root = makeCharacter(spec, tex);
      root.position.set(spec.home.x, 0, spec.home.z);
      scene.add(root);
      actors.push(root);
    } catch (e) {
      console.warn("tex", spec.id, e);
    }
  }
}

async function detectPerson() {
  const now = performance.now();
  if (now - lastFaceCheck < 400) return presence;
  lastFaceCheck = now;
  if (!window.FaceDetector || !detectPerson.video) return presence;
  try {
    const det = new FaceDetector({ fastMode: true, maxDetectedFaces: 1 });
    const snap = document.createElement("canvas");
    snap.width = 160; snap.height = 90;
    const v = detectPerson.video;
    if (!v.videoWidth) return presence;
    snap.getContext("2d").drawImage(v, 0, 0, 160, 90);
    return (await det.detect(snap)).length > 0;
  } catch (_) { return presence; }
}

async function startPresenceCam() {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: false, video: { facingMode: "user", width: { ideal: 320 }, height: { ideal: 240 } }
    });
    const video = document.createElement("video");
    video.playsInline = true; video.muted = true; video.srcObject = stream;
    await video.play().catch(() => {});
    detectPerson.video = video;
  } catch (_) {}
}

function pickActor(ev) {
  const r = canvas.getBoundingClientRect();
  pointer.x = ((ev.clientX - r.left) / r.width) * 2 - 1;
  pointer.y = -((ev.clientY - r.top) / r.height) * 2 + 1;
  raycaster.setFromCamera(pointer, camera);
  const hits = raycaster.intersectObjects(actors, true);
  if (!hits.length) return null;
  let o = hits[0].object;
  while (o && !o.userData.spec) o = o.parent;
  return o;
}

function goKids(id) {
  if (going) return;
  going = true;
  hint.textContent = `${SPECS.find((s) => s.id === id).name} will perform`;
  setTimeout(() => { location.href = `../kids/?char=${id}`; }, 1100);
}

canvas.addEventListener("pointerdown", (ev) => {
  const hit = pickActor(ev);
  if (!hit) return;
  const id = hit.userData.spec.id;
  if (selected === id && state === "greet") { goKids(id); return; }
  selected = id;
  state = "greet";
  hint.textContent = `${hit.userData.spec.name} — tap again`;
});

function tick() {
  requestAnimationFrame(tick);
  const t = clock.elapsedTime;
  const now = performance.now();
  detectPerson().then((seen) => {
    if (going) return;
    if (seen) {
      absentSince = 0;
      if (!presence) presentSince = now;
      presence = true;
      if (state === "idle" && now - presentSince > 2000) {
        state = "greet"; selected = "cutea";
        hint.textContent = "Cutea sees you";
      }
    } else {
      if (!absentSince) absentSince = now;
      if (now - absentSince > 5000) {
        presence = false; presentSince = 0; state = "idle"; selected = "cutea";
        hint.textContent = "Friends on stage";
      }
    }
  });
  for (const actor of actors) {
    const spec = actor.userData.spec;
    const on = spec.id === selected && state === "greet";
    const tgt = on ? spec.greet : spec.home;
    actor.position.x += (tgt.x - actor.position.x) * 0.06;
    actor.position.z += (tgt.z - actor.position.z) * 0.06;
    const bounce = Math.sin(t * (on ? 5.0 : 2.4) + spec.scale) * (on ? 0.07 : 0.04);
    const sway = Math.sin(t * (on ? 3.2 : 1.4)) * (on ? 0.07 : 0.035);
    actor.userData.body.position.y = actor.userData.baseH / 2 + bounce;
    actor.userData.body.rotation.z = sway;
    actor.userData.shadow.scale.setScalar(1 + bounce * 0.2);
    actor.userData.shadow.material.opacity = on ? 0.34 : 0.22;
  }
  renderer.render(scene, camera);
}

boot().then(startPresenceCam);
tick();
