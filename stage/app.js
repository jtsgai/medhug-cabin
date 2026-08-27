import * as THREE from "https://esm.sh/three@0.167.1";
import { GLTFLoader } from "https://esm.sh/three@0.167.1/examples/jsm/loaders/GLTFLoader.js";

const canvas = document.querySelector("#stage");
const hint = document.querySelector("#hint");
const SPECS = [
  { id: "cutea", name: "Cutea", file: "Cutea.png", glb: "cutea.glb", role: "host", home: { x: 0, y: 0, z: 0, s: 1 }, greet: { x: 0, y: 0, z: 1.35, s: 1.18 } },
  { id: "filo", name: "Filo", file: "Filo.png", glb: "filo.glb", role: "play", home: { x: 1.35, y: 0, z: -0.55, s: 0.86 }, greet: { x: 0, y: 0, z: 1.35, s: 1.16 } },
  { id: "halo", name: "Halo", file: "Halo.png", glb: "halo.glb", role: "magic", home: { x: -1.15, y: 1.15, z: -0.15, s: 0.62 }, greet: { x: 0, y: 0.45, z: 1.45, s: 0.95 } }
];

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x000000);
const camera = new THREE.PerspectiveCamera(34, 1, 0.1, 60);
camera.position.set(0, 1.25, 6.4);
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setClearColor(0x000000, 1);
renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2));
const key = new THREE.DirectionalLight(0xfff2e0, 1.35);
key.position.set(2.2, 4.2, 3.4);
scene.add(key);
scene.add(new THREE.HemisphereLight(0xffffff, 0x111111, 0.7));
scene.add(new THREE.DirectionalLight(0x88aaff, 0.45)).position.set(-3, 1.5, -2);

const actors = [];
let selected = "cutea", state = "idle", presence = false, presentSince = 0, absentSince = 0, lastFaceCheck = 0, going = false;
const clock = new THREE.Clock();
const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();
const gltfLoader = new GLTFLoader();
const texLoader = new THREE.TextureLoader();

function resize() {
  camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); renderer.setSize(innerWidth, innerHeight, false);
}
addEventListener("resize", resize); resize();
function mat(color, extra={}) { return new THREE.MeshStandardMaterial({ color, roughness: 0.45, metalness: 0.08, ...extra }); }
function foot(g) {
  const m = new THREE.Mesh(new THREE.CircleGeometry(0.38, 24), new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.28 }));
  m.rotation.x = -Math.PI/2; m.position.y = -1.15; g.add(m);
}
function makeCutea() {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.32, 0.62, 6, 16), mat(0xc62828)); body.position.y = -0.35;
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.38, 28, 20), mat(0x2a2a2a)); head.position.y = 0.48;
  const earL = new THREE.Mesh(new THREE.ConeGeometry(0.14, 0.28, 10), mat(0x1a1a1a)); earL.position.set(-0.2, 0.82, 0);
  const earR = earL.clone(); earR.position.x = 0.2;
  const badge = new THREE.Mesh(new THREE.CircleGeometry(0.09, 20), mat(0xf4c430, { emissive: 0xf4c430, emissiveIntensity: 0.35 })); badge.position.set(0.16, -0.18, 0.33);
  g.add(body, head, earL, earR, badge); foot(g); return g;
}
function makeFilo() {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.3, 0.58, 6, 16), mat(0xf5d76e)); body.position.y = -0.36;
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.36, 28, 20), mat(0xf08a24)); head.position.y = 0.44;
  const snout = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.22, 10), mat(0xffb15a)); snout.rotation.x = Math.PI/2; snout.position.set(0, 0.38, 0.34);
  const earL = new THREE.Mesh(new THREE.ConeGeometry(0.1, 0.32, 8), mat(0xe87716)); earL.position.set(-0.18, 0.78, 0);
  const earR = earL.clone(); earR.position.x = 0.18;
  const tail = new THREE.Mesh(new THREE.CapsuleGeometry(0.07, 0.7, 4, 8), mat(0xff5ea8, { emissive: 0xff5ea8, emissiveIntensity: 0.2 })); tail.rotation.z = 0.9; tail.position.set(0.42, -0.35, -0.2);
  g.add(body, head, snout, earL, earR, tail); foot(g); return g;
}
function makeHalo() {
  const g = new THREE.Group();
  g.add(new THREE.Mesh(new THREE.IcosahedronGeometry(0.38, 1), mat(0xff3b1a, { emissive: 0xff2a00, emissiveIntensity: 0.8, roughness: 0.25 })));
  g.add(new THREE.Mesh(new THREE.SphereGeometry(0.52, 18, 14), new THREE.MeshBasicMaterial({ color: 0xff5522, transparent: true, opacity: 0.18 })));
  return g;
}
const proxies = { cutea: makeCutea, filo: makeFilo, halo: makeHalo };
function tryGLB(spec) {
  return new Promise((resolve) => {
    gltfLoader.load(`./models/${spec.glb}`, (gltf) => {
      const root = gltf.scene;
      const box = new THREE.Box3().setFromObject(root);
      const size = box.getSize(new THREE.Vector3()).length() || 1;
      root.scale.multiplyScalar(2.2 / size);
      root.position.sub(box.getCenter(new THREE.Vector3()).multiplyScalar(root.scale.x));
      resolve(root);
    }, undefined, () => resolve(null));
  });
}
function faceDecal(group, url) {
  texLoader.load(url, (tex) => {
    tex.colorSpace = THREE.SRGBColorSpace;
    const p = new THREE.Mesh(new THREE.PlaneGeometry(0.55, 0.55), new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false }));
    p.position.set(0, 0.48, 0.4); group.add(p);
  });
}
async function boot() {
  for (const spec of SPECS) {
    const glb = await tryGLB(spec);
    const root = glb || proxies[spec.id]();
    if (!glb && spec.id !== "halo") faceDecal(root, `../kids/assets/${spec.file}`);
    root.userData.spec = spec;
    root.position.set(spec.home.x, spec.home.y, spec.home.z);
    root.scale.setScalar(spec.home.s);
    scene.add(root); actors.push(root);
  }
  hint.textContent = "3D stage — tap a friend";
}
async function detectPerson() {
  const now = performance.now(); if (now - lastFaceCheck < 350) return presence; lastFaceCheck = now;
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
function goKids(id) {
  if (going) return; going = true;
  hint.textContent = `${SPECS.find(s => s.id === id).name} will perform`;
  setTimeout(() => { location.href = `../kids/?char=${id}`; }, 1400);
}
canvas.addEventListener("pointerdown", (ev) => {
  const hit = pickActor(ev); if (!hit) return;
  const id = hit.userData.spec.id;
  if (selected === id && state === "greet") { goKids(id); return; }
  selected = id; state = "greet";
  hint.textContent = `${hit.userData.spec.name} steps forward — tap again to perform`;
});
function tick() {
  requestAnimationFrame(tick);
  const t = clock.getElapsedTime(), now = performance.now();
  detectPerson().then((seen) => {
    if (going) return;
    if (seen) {
      absentSince = 0; if (!presence) presentSince = now; presence = true;
      if (state === "idle" && now - presentSince > 2200) { state = "greet"; selected = "cutea"; hint.textContent = "Cutea sees you"; }
    } else {
      if (!absentSince) absentSince = now;
      if (now - absentSince > 5000) { presence = false; presentSince = 0; state = "idle"; selected = "cutea"; hint.textContent = "3D stage — tap a friend"; }
    }
  });
  for (const actor of actors) {
    const spec = actor.userData.spec;
    const on = spec.id === selected && state === "greet";
    const tgt = on ? spec.greet : spec.home;
    const bob = spec.role === "magic" ? Math.sin(t * 2.4) * 0.1 : Math.sin(t * 1.6) * 0.04;
    actor.position.x += (tgt.x - actor.position.x) * 0.07;
    actor.position.y += (tgt.y + bob - actor.position.y) * 0.07;
    actor.position.z += (tgt.z - actor.position.z) * 0.07;
    const s = actor.scale.x + (tgt.s - actor.scale.x) * 0.07;
    actor.scale.setScalar(s);
    actor.rotation.y = spec.role === "magic" ? t * 0.7 : (on ? Math.sin(t * 2) * 0.25 : Math.sin(t * 0.6) * 0.12);
    if (spec.role === "play") actor.rotation.z = Math.sin(t * 1.4) * 0.06;
  }
  renderer.render(scene, camera);
}
boot().then(startPresenceCam);
tick();
