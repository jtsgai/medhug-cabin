import * as THREE from "https://esm.sh/three@0.167.1";

const canvas = document.querySelector("#stage");
const hint = document.querySelector("#hint");
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x000000);
const camera = new THREE.PerspectiveCamera(32, 1, 0.1, 50);
camera.position.set(0, 1.15, 6.2);
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false });
renderer.setClearColor(0x000000, 1);
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
scene.add(new THREE.DirectionalLight(0xffffff, 1.1)).position.set(0.6, 2.2, 4);
scene.add(new THREE.AmbientLight(0xffffff, 0.55));

let cutea = null;
let state = "idle";
let presence = false;
let presentSince = 0;
let absentSince = 0;
let lastFaceCheck = 0;
const clock = new THREE.Clock();

function resize() {
  const w = window.innerWidth, h = window.innerHeight;
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  renderer.setSize(w, h, false);
}
window.addEventListener("resize", resize);
resize();

function makeSprite(url) {
  return new Promise((resolve, reject) => {
    new THREE.TextureLoader().load(url, (tex) => {
      tex.colorSpace = THREE.SRGBColorSpace;
      const mat = new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false });
      const sp = new THREE.Sprite(mat);
      const img = tex.image;
      const ratio = img && img.width && img.height ? img.width / img.height : 0.72;
      sp.scale.set(ratio * 2.8, 2.8, 1);
      resolve(sp);
    }, undefined, reject);
  });
}

async function boot() {
  try {
    cutea = await makeSprite("../kids/assets/Cutea.png");
    cutea.position.set(0, 0.15, 0);
    scene.add(cutea);
    hint.textContent = "Cutea is waiting";
  } catch (e) {
    hint.textContent = "Missing Cutea.png";
  }
}

async function detectPerson() {
  const now = performance.now();
  if (now - lastFaceCheck < 350) return presence;
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
    video.setAttribute("playsinline", "");
    video.muted = true;
    video.srcObject = stream;
    await video.play().catch(() => {});
    detectPerson.video = video;
  } catch (_) {
    hint.textContent = "Camera off — tap Cutea to perform";
  }
}

function goKids() { window.location.href = "../kids/?char=cutea"; }

canvas.addEventListener("pointerdown", () => {
  if (!cutea) return;
  state = "greet";
  hint.textContent = "Cutea says hi — going to perform";
  setTimeout(goKids, 1600);
});

function tick() {
  requestAnimationFrame(tick);
  const t = clock.getElapsedTime();
  const now = performance.now();
  detectPerson().then((seen) => {
    if (seen) {
      absentSince = 0;
      if (!presence) presentSince = now;
      presence = true;
      if (state === "idle" && now - presentSince > 2200) {
        state = "greet";
        hint.textContent = "Cutea sees you";
      }
    } else {
      if (!absentSince) absentSince = now;
      if (now - absentSince > 5000) {
        presence = false;
        presentSince = 0;
        if (state !== "idle") {
          state = "idle";
          hint.textContent = "Cutea is waiting";
        }
      }
    }
  });
  if (cutea) {
    const approaching = state === "greet";
    const targetZ = approaching ? 1.35 : 0;
    const targetScale = approaching ? 3.25 : 2.8;
    cutea.position.z += (targetZ - cutea.position.z) * 0.06;
    cutea.position.x = Math.sin(t * 0.9) * 0.04;
    cutea.position.y = 0.12 + Math.sin(t * 1.6) * 0.06 + (approaching ? 0.08 : 0);
    const img = cutea.material.map && cutea.material.map.image;
    const ratio = img && img.width && img.height ? img.width / img.height : 0.72;
    const s = cutea.scale.y + (targetScale - cutea.scale.y) * 0.06;
    cutea.scale.set(ratio * s, s, 1);
    cutea.material.rotation = approaching ? Math.sin(t * 6) * 0.06 : Math.sin(t * 1.2) * 0.02;
  }
  renderer.render(scene, camera);
}
boot().then(startPresenceCam);
tick();
