import * as THREE from "https://esm.sh/three@0.167.1";
import { GLTFLoader } from "https://esm.sh/three@0.167.1/examples/jsm/loaders/GLTFLoader.js";
import { createCutea, createFilo, createHalo, animateCutea, animateFilo, animateHalo } from "./characters.js";

const canvas = document.querySelector("#stage");
const hint = document.querySelector("#hint");
const SPECS = [
  { id: "cutea", name: "Cutea", glb: "cutea.glb", make: createCutea, anim: animateCutea, home: { x: 0, y: -0.2, z: 0, s: 1 }, greet: { x: 0, y: -0.15, z: 1.25, s: 1.15 } },
  { id: "filo", name: "Filo", glb: "filo.glb", make: createFilo, anim: animateFilo, home: { x: 1.45, y: -0.2, z: -0.5, s: 0.88 }, greet: { x: 0, y: -0.15, z: 1.25, s: 1.12 } },
  { id: "halo", name: "Halo", glb: "halo.glb", make: createHalo, anim: animateHalo, home: { x: -1.25, y: 1.05, z: -0.1, s: 0.78 }, greet: { x: 0, y: 0.55, z: 1.35, s: 1.05 } }
];
const scene = new THREE.Scene(); scene.background = new THREE.Color(0x000000);
const camera = new THREE.PerspectiveCamera(34, 1, 0.1, 60); camera.position.set(0, 1.15, 6.5);
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setClearColor(0x000000, 1); renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2));
scene.add(new THREE.HemisphereLight(0xffffff, 0x101010, 0.75));
scene.add(new THREE.DirectionalLight(0xfff4e5, 1.4)).position.set(2, 4, 3.2);
const actors = []; let selected = "cutea", state = "idle", presence = false, presentSince = 0, absentSince = 0, lastFaceCheck = 0, going = false;
const clock = new THREE.Clock(); const raycaster = new THREE.Raycaster(); const pointer = new THREE.Vector2(); const gltfLoader = new GLTFLoader();
function resize() { camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); renderer.setSize(innerWidth, innerHeight, false); }
addEventListener("resize", resize); resize();
function tryGLB(spec) {
  return new Promise((resolve) => {
    gltfLoader.load(`./models/${spec.glb}`, (gltf) => {
      const root = gltf.scene; const box = new THREE.Box3().setFromObject(root);
      const size = box.getSize(new THREE.Vector3()).length() || 1;
      root.scale.multiplyScalar(2.3 / size);
      root.position.sub(box.getCenter(new THREE.Vector3()).multiplyScalar(root.scale.x));
      resolve(root);
    }, undefined, () => resolve(null));
  });
}
async function boot() {
  for (const spec of SPECS) {
    const root = (await tryGLB(spec)) || spec.make();
    root.userData.spec = spec;
    root.position.set(spec.home.x, spec.home.y, spec.home.z);
    root.scale.setScalar(spec.home.s);
    scene.add(root); actors.push(root);
  }
  hint.textContent = "3D friends on stage";
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
  selected = id; state = "greet"; hint.textContent = `${hit.userData.spec.name} steps forward — tap again`;
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
      if (now - absentSince > 5000) { presence = false; presentSince = 0; state = "idle"; selected = "cutea"; hint.textContent = "3D friends on stage"; }
    }
  });
  for (const actor of actors) {
    const spec = actor.userData.spec;
    const on = spec.id === selected && state === "greet";
    const tgt = on ? spec.greet : spec.home;
    actor.position.x += (tgt.x - actor.position.x) * 0.07;
    actor.position.y += (tgt.y - actor.position.y) * 0.07;
    actor.position.z += (tgt.z - actor.position.z) * 0.07;
    const s = actor.scale.x + (tgt.s - actor.scale.x) * 0.07; actor.scale.setScalar(s);
    if (spec.anim && actor.userData.joints) spec.anim(actor, t, on);
    else actor.rotation.y += on ? 0.02 : 0.008;
  }
  renderer.render(scene, camera);
}
boot().then(startPresenceCam); tick();
