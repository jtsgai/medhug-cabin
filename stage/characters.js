import * as THREE from "https://esm.sh/three@0.167.1";
function M(color, extra = {}) {
  return new THREE.MeshStandardMaterial({ color, roughness: 0.42, metalness: 0.06, ...extra });
}
function joint(name) { const g = new THREE.Group(); g.name = name; return g; }
export function createCutea() {
  const root = joint("cutea"); const hips = joint("hips"); const spine = joint("spine"); const head = joint("head");
  const earL = joint("earL"); const earR = joint("earR"); const armL = joint("armL"); const armR = joint("armR"); const tail = joint("tail");
  const pelvis = new THREE.Mesh(new THREE.SphereGeometry(0.28, 20, 14), M(0x1c1c1c)); pelvis.scale.set(1, 0.7, 0.8); hips.add(pelvis);
  const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.34, 0.55, 6, 18), M(0xd32f2f)); torso.position.y = 0.55; spine.add(torso);
  const star = new THREE.Mesh(new THREE.CircleGeometry(0.1, 5), M(0xffd54f, { emissive: 0xffc107, emissiveIntensity: 0.45 })); star.position.set(0.18, 0.52, 0.34); spine.add(star);
  const skull = new THREE.Mesh(new THREE.SphereGeometry(0.4, 28, 20), M(0x222222));
  const bang = new THREE.Mesh(new THREE.SphereGeometry(0.26, 16, 12), M(0x0d0d0d)); bang.scale.set(1.15, 0.55, 0.7); bang.position.set(0, 0.18, 0.22);
  const nose = new THREE.Mesh(new THREE.SphereGeometry(0.05, 10, 8), M(0xff8a80)); nose.position.set(0, -0.02, 0.38);
  const eyeL = new THREE.Mesh(new THREE.SphereGeometry(0.055, 10, 8), M(0xfafafa)); eyeL.position.set(-0.13, 0.06, 0.34);
  const eyeR = eyeL.clone(); eyeR.position.x = 0.13;
  head.add(skull, bang, nose, eyeL, eyeR); head.position.y = 1.22;
  const eL = new THREE.Mesh(new THREE.ConeGeometry(0.13, 0.32, 8), M(0x141414)); eL.position.y = 0.16; earL.add(eL); earL.position.set(-0.22, 0.28, 0);
  const eR = eL.clone(); earR.add(eR); earR.position.set(0.22, 0.28, 0); head.add(earL, earR);
  const aL = new THREE.Mesh(new THREE.CapsuleGeometry(0.08, 0.42, 4, 10), M(0xd32f2f)); aL.position.y = -0.28; armL.add(aL); armL.position.set(-0.42, 0.7, 0);
  const aR = aL.clone(); armR.add(aR); armR.position.set(0.42, 0.7, 0);
  const t = new THREE.Mesh(new THREE.CapsuleGeometry(0.07, 0.45, 4, 8), M(0x1a1a1a)); t.position.set(0, -0.22, -0.05); t.rotation.x = 0.6; tail.add(t); tail.position.set(0, 0.1, -0.25);
  hips.add(spine, armL, armR, tail); spine.add(head); root.add(hips);
  root.userData.joints = { hips, spine, head, earL, earR, armL, armR, tail }; return root;
}
export function createFilo() {
  const root = joint("filo"); const hips = joint("hips"); const spine = joint("spine"); const head = joint("head");
  const earL = joint("earL"); const earR = joint("earR"); const armL = joint("armL"); const armR = joint("armR"); const tail1 = joint("tail1"); const tail2 = joint("tail2");
  const pelvis = new THREE.Mesh(new THREE.SphereGeometry(0.26, 18, 12), M(0xf3c14a)); pelvis.scale.set(1, 0.65, 0.85); hips.add(pelvis);
  const shirt = new THREE.Mesh(new THREE.CapsuleGeometry(0.32, 0.5, 6, 16), M(0xffe082)); shirt.position.y = 0.5; spine.add(shirt);
  const skull = new THREE.Mesh(new THREE.SphereGeometry(0.36, 26, 18), M(0xf08a24));
  const snout = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.24, 10), M(0xffb74d)); snout.rotation.x = Math.PI / 2; snout.position.set(0, -0.04, 0.34);
  const eyeL = new THREE.Mesh(new THREE.SphereGeometry(0.05, 10, 8), M(0x111111)); eyeL.position.set(-0.12, 0.06, 0.3);
  const eyeR = eyeL.clone(); eyeR.position.x = 0.12;
  head.add(skull, snout, eyeL, eyeR); head.position.y = 1.12;
  const eL = new THREE.Mesh(new THREE.ConeGeometry(0.09, 0.36, 8), M(0xe65100)); eL.position.y = 0.18; earL.add(eL); earL.position.set(-0.16, 0.26, 0);
  const eR = eL.clone(); earR.add(eR); earR.position.set(0.16, 0.26, 0); head.add(earL, earR);
  const aL = new THREE.Mesh(new THREE.CapsuleGeometry(0.07, 0.4, 4, 10), M(0xffe082)); aL.position.y = -0.26; armL.add(aL); armL.position.set(-0.4, 0.66, 0);
  const aR = aL.clone(); armR.add(aR); armR.position.set(0.4, 0.66, 0);
  const seg1 = new THREE.Mesh(new THREE.CapsuleGeometry(0.08, 0.38, 4, 8), M(0xff6fa8, { emissive: 0xff4081, emissiveIntensity: 0.2 })); seg1.position.set(0.08, 0, -0.18); tail1.add(seg1);
  const seg2 = new THREE.Mesh(new THREE.CapsuleGeometry(0.06, 0.34, 4, 8), M(0x7c4dff, { emissive: 0x7c4dff, emissiveIntensity: 0.18 })); seg2.position.set(0.12, 0.05, -0.16); tail2.add(seg2);
  tail1.position.set(0.12, 0.12, -0.22); tail1.add(tail2);
  hips.add(spine, armL, armR, tail1); spine.add(head); root.add(hips);
  root.userData.joints = { hips, spine, head, earL, earR, armL, armR, tail1, tail2 }; return root;
}
export function createHalo() {
  const root = joint("halo"); const core = joint("core"); const flame = joint("flame");
  core.add(new THREE.Mesh(new THREE.IcosahedronGeometry(0.34, 1), M(0xff3d00, { emissive: 0xff3d00, emissiveIntensity: 1.1, roughness: 0.22 })));
  for (let i = 0; i < 6; i++) {
    const spike = new THREE.Mesh(new THREE.ConeGeometry(0.09, 0.38, 6), M(0xff6e40, { emissive: 0xff6e40, emissiveIntensity: 0.6, transparent: true, opacity: 0.9 }));
    const a = (i / 6) * Math.PI * 2;
    spike.position.set(Math.cos(a) * 0.22, Math.sin(a * 1.7) * 0.1, Math.sin(a) * 0.22);
    spike.lookAt(0, 0, 0); flame.add(spike);
  }
  root.add(core, flame, new THREE.Mesh(new THREE.SphereGeometry(0.58, 20, 16), new THREE.MeshBasicMaterial({ color: 0xff5722, transparent: true, opacity: 0.14 })));
  root.userData.joints = { core, flame }; return root;
}
export function animateCutea(root, t, greet) {
  const j = root.userData.joints;
  j.head.rotation.y = Math.sin(t * 1.2) * 0.18; j.head.rotation.x = Math.sin(t * 0.8) * 0.06;
  j.earL.rotation.z = 0.15 + Math.sin(t * 3.2) * 0.12; j.earR.rotation.z = -0.15 - Math.sin(t * 3.2 + 0.4) * 0.12;
  j.armR.rotation.z = greet ? -0.2 + Math.sin(t * 8) * 0.55 : Math.sin(t * 1.4) * 0.12;
  j.armL.rotation.z = greet ? 0.15 : -Math.sin(t * 1.4) * 0.12;
  j.tail.rotation.x = 0.4 + Math.sin(t * 2.2) * 0.25; j.spine.rotation.y = Math.sin(t * 0.7) * 0.08;
}
export function animateFilo(root, t, greet) {
  const j = root.userData.joints;
  j.head.rotation.y = Math.sin(t * 1.6) * 0.28;
  j.earL.rotation.z = 0.2 + Math.sin(t * 4) * 0.16; j.earR.rotation.z = -0.2 - Math.sin(t * 4 + 0.3) * 0.16;
  j.tail1.rotation.y = Math.sin(t * 3.2) * 0.55; j.tail2.rotation.y = Math.sin(t * 3.2 + 0.6) * 0.4;
  j.hips.rotation.y = greet ? Math.sin(t * 5) * 0.35 : Math.sin(t * 1.1) * 0.1;
  j.armR.rotation.z = greet ? -0.3 + Math.sin(t * 7) * 0.4 : 0.05;
}
export function animateHalo(root, t, greet) {
  const j = root.userData.joints;
  j.core.rotation.y = t * 1.3; j.core.rotation.x = t * 0.4; j.flame.rotation.y = -t * 1.8;
  const pulse = 1 + Math.sin(t * 5) * 0.08 + (greet ? 0.12 : 0); j.core.scale.setScalar(pulse);
}
