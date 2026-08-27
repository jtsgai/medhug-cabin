import * as THREE from "https://esm.sh/three@0.167.1";
import { GLTFLoader } from "https://esm.sh/three@0.167.1/examples/jsm/loaders/GLTFLoader.js";
import { DRACOLoader } from "https://esm.sh/three@0.167.1/examples/jsm/loaders/DRACOLoader.js";
import { createCutea, createFilo, createHalo, animateCutea, animateFilo, animateHalo } from "./characters.js";

const canvas = document.querySelector("#stage");
const hint = document.querySelector("#hint");
const SPECS = [
  { id: "cutea", name: "Cutea", glb: "cutea_web.glb", make: createCutea, anim: animateCutea, home: { x: 0, z: 0.2 }, greet: { x: 0, z: 0.9 } },
  { id: "filo", name: "Filo", glb: "filo_web.glb", make: createFilo, anim: animateFilo, home: { x: 1.15, z: -0.15 }, greet: { x: 0.15, z: 0.85 } },
  { id: "halo", name: "Halo", glb: "halo_web.glb", make: createHalo, anim: animateHalo, home: { x: -1.15, z: -0.1 }, greet: { x: -0.15, z: 0.85 } }
];

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x000000);
const camera = new THREE.PerspectiveCamera(26, 1, 0.1, 80);
camera.position.set(0, 1.55, 8.6);
camera.lookAt(0, 0.7, 0);

const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false });
renderer.setClearColor(0x000000, 1);
renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

const hemi = new THREE.HemisphereLight(0xf4f0ea, 0x050505, 0.55);
scene.add(hemi);
const key = new THREE.DirectionalLight(0xfff3dc, 1.8);
key.position.set(1.6, 7.2, 4.2);
key.castShadow = true;
key.shadow.mapSize.set(1024, 1024);
key.shadow.camera.near = 0.5; key.shadow.camera.far = 18;
key.shadow.camera.left = -4; key.shadow.camera.right = 4;
key.shadow.camera.top = 4; key.shadow.camera.bottom = -4;
scene.add(key);
const rim = new THREE.DirectionalLight(0x88bbff, 0.35);
rim.position.set(-3, 2.4, -2); scene.add(rim);

const floor = new THREE.Mesh(
  new THREE.CircleGeometry(3.4, 48),
  new THREE.ShadowMaterial({ opacity: 0.5 })
);
floor.rotation.x = -Math.PI / 2;
floor.position.y = 0;
floor.receiveShadow = true;
scene.add(floor);

const draco = new DRACOLoader();
draco.setDecoderPath("https://www.gstatic.com/draco/versioned/decoders/1.5.7/");
const gltfLoader = new GLTFLoader();
gltfLoader.setDRACOLoader(draco);

const actors = [];
const mixers = [];
let selected = "cutea", state = "idle", presence = false, presentSince = 0, absentSince = 0, lastFaceCheck = 0, going = false;
const clock = new THREE.Clock();
const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();
const TARGET_HEIGHT = 1.55;

function resize() {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight, false);
}
addEventListener("resize", resize); resize();

function plantOnFloor(root) {
  root.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(root);
  const size = box.getSize(new THREE.Vector3());
  const h = Math.max(size.y, 0.01);
  root.scale.multiplyScalar(TARGET_HEIGHT / h);
  root.updateMatrixWorld(true);
  const box2 = new THREE.Box3().setFromObject(root);
  root.position.y += -box2.min.y;
  root.position.x -= (box2.max.x + box2.min.x) / 2;
  root.position.z -= (box2.max.z + box2.min.z) / 2;
  root.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
}

function tryGLB(spec) {
  return new Promise((resolve) => {
    gltfLoader.load(`./models/${spec.glb}`, (gltf) => {
      const root = gltf.scene;
      plantOnFloor(root);
      if (gltf.animations?.length) {
        const mixer = new THREE.AnimationMixer(root);
        mixer.clipAction(gltf.animations[0]).play();
        mixers.push(mixer);
      }
      root.userData.isGltf = true;
      resolve(root);
    }, undefined, () => resolve(null));
  });
}

async function boot() {
  hint.textContent = "Loading friends…";
  for (const spec of SPECS) {
    const root = (await tryGLB(spec)) || spec.make();
    if (!root.userData.isGltf) plantOnFloor(root);
    root.userData.spec = spec;
    root.position.x += spec.home.x;
    root.position.z += spec.home.z;
    scene.add(root); actors.push(root);
  }
  hint.textContent = "Friends on stage";
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
function goKids(id) {
  if (going) return; going = true;
  hint.textContent = `${SPECS.find((s) => s.id === id).name} will perform`;
  setTimeout(() => { location.href = `../kids/?char=${id}`; }, 1400);
}
canvas.addEventListener("pointerdown", (ev) => {
  const hit = pickActor(ev);
  if (!hit) return;
  const id = hit.userData.spec.id;
  if (selected === id && state === "greet") { goKids(id); return; }
  selected = id; state = "greet";
  hint.textContent = `${hit.userData.spec.name} steps forward — tap again`;
});
function tick() {
  requestAnimationFrame(tick);
  const dt = clock.getDelta(); const t = clock.elapsedTime; const now = performance.now();
  mixers.forEach((m) => m.update(dt));
  detectPerson().then((seen) => {
    if (going) return;
    if (seen) {
      absentSince = 0; if (!presence) presentSince = now; presence = true;
      if (state === "idle" && now - presentSince > 2200) { state = "greet"; selected = "cutea"; hint.textContent = "Cutea sees you"; }
    } else {
      if (!absentSince) absentSince = now;
      if (now - absentSince > 5000) { presence = false; presentSince = 0; state = "idle"; selected = "cutea"; hint.textContent = "Friends on stage"; }
    }
  });
  for (const actor of actors) {
    const spec = actor.userData.spec;
    const on = spec.id === selected && state === "greet";
    const tgt = on ? spec.greet : spec.home;
    actor.position.x += (tgt.x - actor.position.x) * 0.06;
    actor.position.z += (tgt.z - actor.position.z) * 0.06;
    if (spec.id === "cutea") actor.rotation.y = on ? Math.sin(t * 3) * 0.28 : Math.sin(t * 0.7) * 0.16;
    else if (spec.anim && actor.userData.joints) spec.anim(actor, t, on);
    else actor.rotation.y += on ? 0.015 : 0.006;
  }
  renderer.render(scene, camera);
}
boot().then(startPresenceCam); tick();
