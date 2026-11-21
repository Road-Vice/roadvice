import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

export const SKINS = [0xd9a679, 0xc98d5f, 0x8a5c39, 0x6b4530, 0xe8c39a, 0xb57a4f];
export const SHIRTS = [0xd9536b, 0x53a0d9, 0xe8c33a, 0x59d97c, 0xd9d9d9, 0x8a5ad9, 0xe8804a, 0x2c2c34, 0xff2d95, 0x35f0e0];
export const PANTS = [0x2c3550, 0x3a3a42, 0x59452e, 0x1e1e26, 0xa0a0a8];

const skinMat = () => new THREE.MeshStandardMaterial({ color: 0xc98d5f, roughness: 0.75, metalness: 0 });
const clothMat = (c) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.85, metalness: 0.05 });
const darkMat = () => new THREE.MeshStandardMaterial({ color: 0x15151c, roughness: 0.7 });

function geoM(geo, x, y, z, rx = 0, ry = 0, rz = 0) {
  if (rx || ry || rz) {
    const m = new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(rx, ry, rz));
    geo.applyMatrix4(m);
  }
  geo.translate(x, y, z);
  return geo;
}

/* ------- géométries partagées pour la foule (instanciée) ------- */
export function crowdTorsoGeometry() {
  const torso = geoM(new THREE.BoxGeometry(0.5, 0.7, 0.26), 0, 1.26, 0);
  const shoulder = geoM(new THREE.BoxGeometry(0.58, 0.16, 0.26), 0, 1.52, 0);
  const neck = geoM(new THREE.CylinderGeometry(0.085, 0.095, 0.12, 8), 0, 1.68, 0);
  const armL = geoM(new THREE.BoxGeometry(0.13, 0.58, 0.15), 0, 0, 0, 0, 0, 0.1);
  armL.translate(-0.345, 1.22, 0);
  const armR = geoM(new THREE.BoxGeometry(0.13, 0.58, 0.15), 0, 0, 0, 0, 0, -0.1);
  armR.translate(0.345, 1.22, 0);
  return mergeGeometries([torso, shoulder, neck, armL, armR]);
}
export const crowdHeadGeometry = () => new THREE.SphereGeometry(0.165, 10, 8);
export function crowdLegGeometry() {
  const g = new THREE.BoxGeometry(0.16, 0.78, 0.2);
  g.translate(0, -0.39, 0);
  return g;
}

/* ------- PNJ de police / armée ------- */
export function buildHumanGroup({ shirt = 0x2a4b8f, skin = 0xc98d5f, hat = 0x1a2a4a, baton = false } = {}) {
  const g = new THREE.Group();
  const sh = clothMat(shirt), sk = skinMat(skin), dk = darkMat();

  const hips = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.2, 0.26), dk);
  hips.position.y = 0.98; hips.castShadow = true; g.add(hips);
  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.66, 0.27), sh);
  torso.position.y = 1.4; torso.castShadow = true; g.add(torso);
  const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.085, 0.095, 0.12, 8), sk);
  neck.position.y = 1.78; g.add(neck);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.165, 10, 8), sk);
  head.position.y = 1.94; head.castShadow = true; g.add(head);
  const cap = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.11, 0.37), clothMat(hat));
  cap.position.y = 2.07; g.add(cap);
  const visor = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.03, 0.12), clothMat(hat));
  visor.position.set(0, 2.03, 0.2); g.add(visor);

  const armL = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.6, 0.16), sh);
  armL.geometry = geoM(new THREE.BoxGeometry(0.13, 0.6, 0.16), 0, -0.28, 0);
  armL.position.set(-0.33, 1.62, 0); armL.castShadow = true; g.add(armL);
  const armR = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.6, 0.16), sh);
  armR.geometry = geoM(new THREE.BoxGeometry(0.13, 0.6, 0.16), 0, -0.28, 0);
  armR.position.set(0.33, 1.62, 0); armR.castShadow = true; g.add(armR);

  const legL = new THREE.Mesh(new THREE.BoxGeometry(0.17, 0.8, 0.2), dk);
  legL.geometry = geoM(new THREE.BoxGeometry(0.17, 0.8, 0.2), 0, -0.4, 0);
  legL.position.set(-0.12, 0.88, 0); legL.castShadow = true; g.add(legL);
  const legR = new THREE.Mesh(new THREE.BoxGeometry(0.17, 0.8, 0.2), dk);
  legR.geometry = geoM(new THREE.BoxGeometry(0.17, 0.8, 0.2), 0, -0.4, 0);
  legR.position.set(0.12, 0.88, 0); legR.castShadow = true; g.add(legR);

  let weapon = null;
  if (baton) {
    weapon = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.5, 6), dk);
    weapon.geometry.rotateX(Math.PI / 2);
    weapon.position.set(0.33, 1.1, 0.34);
    g.add(weapon);
  } else {
    weapon = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.12, 0.52), dk);
    weapon.position.set(0.33, 1.22, 0.3);
    g.add(weapon);
  }
  return { group: g, legL, legR, armL, armR, weapon, torso };
}

/* ------- personnage du joueur, ultra détaillé, 2 segments par membre ------- */
export function buildPlayerMesh() {
  const g = new THREE.Group();
  const skin = skinMat(0xc98d5f);
  const jacket = clothMat(0xff2d95);
  const tee = clothMat(0xf2f2f2);
  const jeans = clothMat(0x2b3a5c);
  const hairMat = clothMat(0x2b1c12);
  const shoe = clothMat(0x101014);

  const hips = new THREE.Mesh(new THREE.BoxGeometry(0.44, 0.22, 0.26), jeans);
  hips.position.y = 0.98; hips.castShadow = true; g.add(hips);

  const torso = new THREE.Group();
  torso.position.y = 1.06;
  const chest = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.6, 0.27), jacket);
  chest.position.y = 0.36; chest.castShadow = true; torso.add(chest);
  const teeV = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.34, 0.02), tee);
  teeV.position.set(0, 0.34, 0.15); torso.add(teeV);
  const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.09, 0.14, 8), skin);
  neck.position.y = 0.74; torso.add(neck);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.185, 14, 12), skin);
  head.position.y = 0.95; head.castShadow = true; torso.add(head);
  const hair = new THREE.Mesh(new THREE.SphereGeometry(0.195, 14, 10, 0, Math.PI * 2, 0, Math.PI * 0.55), hairMat);
  hair.position.y = 0.97; torso.add(hair);
  for (const x of [-0.07, 0.07]) {
    const eye = new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.03, 0.02), darkMat());
    eye.position.set(x, 0.97, 0.17);
    torso.add(eye);
  }
  g.add(torso);

  const limbs = {};
  const makeLeg = (sx) => {
    const thigh = new THREE.Group();
    thigh.position.set(sx * 0.12, 0.94, 0);
    const tm = new THREE.Mesh(geoM(new THREE.BoxGeometry(0.16, 0.44, 0.2), 0, -0.22, 0), jeans);
    tm.castShadow = true; thigh.add(tm);
    const knee = new THREE.Group();
    knee.position.y = -0.46;
    const shin = new THREE.Mesh(geoM(new THREE.BoxGeometry(0.14, 0.42, 0.17), 0, -0.21, 0), jeans);
    shin.castShadow = true; knee.add(shin);
    const foot = new THREE.Mesh(geoM(new THREE.BoxGeometry(0.15, 0.09, 0.26), 0, 0, 0.04), shoe);
    foot.position.y = -0.45; knee.add(foot);
    thigh.add(knee);
    g.add(thigh);
    return { thigh, knee };
  };
  const makeArm = (sx) => {
    const upper = new THREE.Group();
    upper.position.set(sx * 0.29, 1.62, 0);
    const um = new THREE.Mesh(geoM(new THREE.BoxGeometry(0.13, 0.3, 0.15), 0, -0.15, 0), jacket);
    um.castShadow = true; upper.add(um);
    const elbow = new THREE.Group();
    elbow.position.y = -0.31;
    const fore = new THREE.Mesh(geoM(new THREE.BoxGeometry(0.11, 0.28, 0.13), 0, -0.14, 0), skin);
    fore.castShadow = true; elbow.add(fore);
    const hand = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.11, 0.09), skin);
    hand.position.y = -0.32; elbow.add(hand);
    upper.add(elbow);
    g.add(upper);
    return { upper, elbow };
  };
  limbs.legL = makeLeg(-1); limbs.legR = makeLeg(1);
  limbs.armL = makeArm(-1); limbs.armR = makeArm(1);

  function animate(phase, moveAmt, running, punchT, cuffed) {
    const swing = Math.sin(phase);
    const amp = 0.55 * moveAmt * (running ? 1.5 : 1);
    limbs.legL.thigh.rotation.x = swing * amp;
    limbs.legR.thigh.rotation.x = -swing * amp;
    limbs.legL.knee.rotation.x = -Math.max(0, -swing) * (0.8 + (running ? 0.5 : 0)) * moveAmt - 0.08;
    limbs.legR.knee.rotation.x = -Math.max(0, swing) * (0.8 + (running ? 0.5 : 0)) * moveAmt - 0.08;

    if (cuffed) {
      limbs.armL.upper.rotation.set(0.45, -0.4, 2.2);
      limbs.armR.upper.rotation.set(0.45, 0.4, -2.2);
      limbs.armL.elbow.rotation.x = 0.5;
      limbs.armR.elbow.rotation.x = 0.5;
    } else if (punchT > 0) {
      const p = 1 - punchT / 0.32;
      const thrust = Math.sin(p * Math.PI);
      limbs.armR.upper.rotation.set(-thrust * 1.5, 0, 0);
      limbs.armR.elbow.rotation.x = -0.2 + thrust * 0.25;
      limbs.armL.upper.rotation.set(0.35, 0, 0.12);
      limbs.armL.elbow.rotation.x = -1.2;
    } else {
      limbs.armL.upper.rotation.set(-swing * amp * 0.8, 0, 0.14);
      limbs.armR.upper.rotation.set(swing * amp * 0.8, 0, -0.14);
      limbs.armL.elbow.rotation.x = -0.2 - Math.max(0, swing * amp) * 0.25;
      limbs.armR.elbow.rotation.x = -0.2 - Math.max(0, -swing * amp) * 0.25;
    }
  }

  return { group: g, animate, torso };
}
