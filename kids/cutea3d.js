import * as THREE from "https://esm.sh/three@0.167.1";
import { GLTFLoader } from "https://esm.sh/three@0.167.1/examples/jsm/loaders/GLTFLoader.js";
import { DRACOLoader } from "https://esm.sh/three@0.167.1/examples/jsm/loaders/DRACOLoader.js";

const draco = new DRACOLoader();
draco.setDecoderPath("https://www.gstatic.com/draco/versioned/decoders/1.5.7/");
const loader = new GLTFLoader();
loader.setDRACOLoader(draco);

function mount(card) {
  if (card.dataset.glb3d) return;
  card.dataset.glb3d = "1";
  const img = card.querySelector("img");
  const canvas = document.createElement("canvas");
  canvas.width = 256; canvas.height = 256;
  canvas.style.cssText = "width:222px;height:222px;background:transparent;display:block";
  if (img) img.replaceWith(canvas);
  else card.appendChild(canvas);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(32, 1, 0.1, 20);
  camera.position.set(0, 0.4, 3.2);
  const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true });
  renderer.setClearColor(0x000000, 0);
  renderer.setSize(256, 256, false);
  scene.add(new THREE.HemisphereLight(0xffffff, 0x222222, 1.1));
  scene.add(new THREE.DirectionalLight(0xffffff, 1.2)).position.set(2, 3, 4);

  loader.load("../stage/models/cutea_web.glb", (gltf) => {
    const root = gltf.scene;
    const box = new THREE.Box3().setFromObject(root);
    const size = box.getSize(new THREE.Vector3()).length() || 1;
    root.scale.multiplyScalar(2.1 / size);
    root.position.sub(box.getCenter(new THREE.Vector3()).multiplyScalar(root.scale.x));
    scene.add(root);
    const clock = new THREE.Clock();
    const mixer = gltf.animations && gltf.animations.length ? new THREE.AnimationMixer(root) : null;
    if (mixer) mixer.clipAction(gltf.animations[0]).play();
    (function loop() {
      requestAnimationFrame(loop);
      const t = clock.getElapsedTime();
      if (mixer) mixer.update(clock.getDelta());
      root.rotation.y = Math.sin(t * 1.2) * 0.45;
      renderer.render(scene, camera);
    })();
  });
}

function scan() {
  document.querySelectorAll(".char-card").forEach((card) => {
    const name = (card.querySelector(".char-name")?.textContent || "").toLowerCase();
    const img = card.querySelector("img");
    const alt = (img?.alt || "").toLowerCase();
    if (name.includes("cutea") || alt.includes("cutea")) mount(card);
  });
}
const obs = new MutationObserver(scan);
obs.observe(document.body, { childList: true, subtree: true });
scan();
setTimeout(scan, 800);
