import * as THREE from "https://esm.sh/three@0.167.1";
import { GLTFLoader } from "https://esm.sh/three@0.167.1/examples/jsm/loaders/GLTFLoader.js";
import { DRACOLoader } from "https://esm.sh/three@0.167.1/examples/jsm/loaders/DRACOLoader.js";

const draco = new DRACOLoader();
draco.setDecoderPath("https://www.gstatic.com/draco/versioned/decoders/1.5.7/");
const loader = new GLTFLoader();
loader.setDRACOLoader(draco);

function ensureCenterStage() {
  let host = document.getElementById("cutea-holo");
  if (host) return host;
  const center = document.querySelector(".stage-center") || document.body;
  host = document.createElement("div");
  host.id = "cutea-holo";
  host.style.cssText = "position:absolute;left:50%;bottom:8%;transform:translateX(-50%);width:min(46vw,520px);height:min(42vh,560px);z-index:6;pointer-events:none";
  const canvas = document.createElement("canvas");
  canvas.id = "cutea-holo-canvas";
  canvas.style.cssText = "width:100%;height:100%;display:block;background:transparent";
  host.appendChild(canvas);
  center.appendChild(host);
  return host;
}

function start() {
  const host = ensureCenterStage();
  const canvas = host.querySelector("canvas");
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(28, 1, 0.1, 30);
  camera.position.set(0, 1.15, 5.2);
  const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true });
  renderer.setClearColor(0x000000, 0);
  renderer.shadowMap.enabled = true;
  const light = new THREE.DirectionalLight(0xfff4e8, 1.5);
  light.position.set(1.2, 5, 3); light.castShadow = true; scene.add(light);
  scene.add(new THREE.HemisphereLight(0xffffff, 0x111111, 0.7));
  const floor = new THREE.Mesh(new THREE.CircleGeometry(1.2, 32), new THREE.ShadowMaterial({ opacity: 0.45 }));
  floor.rotation.x = -Math.PI / 2; floor.position.y = -1.05; floor.receiveShadow = true; scene.add(floor);

  function resize() {
    const w = canvas.clientWidth || 400, h = canvas.clientHeight || 500;
    renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix();
  }
  resize(); addEventListener("resize", resize);

  loader.load("../stage/models/cutea_web.glb", (gltf) => {
    const root = gltf.scene;
    root.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
    const box = new THREE.Box3().setFromObject(root);
    const size = box.getSize(new THREE.Vector3());
    root.scale.setScalar(2.2 / Math.max(size.y, 0.01));
    const box2 = new THREE.Box3().setFromObject(root);
    root.position.y -= box2.min.y + 1.05;
    root.position.x -= (box2.max.x + box2.min.x) / 2;
    scene.add(root);
    const mixer = gltf.animations?.length ? new THREE.AnimationMixer(root) : null;
    if (mixer) mixer.clipAction(gltf.animations[0]).play();
    const clock = new THREE.Clock();
    (function loop() {
      requestAnimationFrame(loop);
      const dt = clock.getDelta(); const t = clock.elapsedTime;
      if (mixer) mixer.update(dt);
      root.rotation.y = Math.sin(t * 0.9) * 0.35;
      renderer.render(scene, camera);
    })();
  }, undefined, (e) => console.warn("cutea glb", e));
}

if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start);
else start();
