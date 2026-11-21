import * as THREE from 'three';
import { LIM } from './world.js';

const MAX_FWD = { sedan: 34, taxi: 32, sports: 58, police: 40, army: 33 };
const ACCEL = { sedan: 22, taxi: 20, sports: 34, police: 28, army: 20 };
const PALETTE = [0xc23b3b, 0x3b74c2, 0xd6d6dc, 0x2c2c34, 0xd7b23b, 0x3ba874, 0xb06ad0, 0xd97a35, 0x88919c];

export const CARTYPES = {
  sedan: { w: 1.9, l: 4.2, color: null },
  taxi: { w: 1.9, l: 4.2, color: 0xe8c33a },
  sports: { w: 2.0, l: 4.6, color: 0xff2d95 },
  police: { w: 2.0, l: 4.6, color: 0x14213d },
  army: { w: 2.5, l: 5.6, color: 0x4a5d3a }
};

/* ---------- catalogue procedural : 300 modeles ---------- */
const BRANDS = ['Falco', 'Vortek', 'Marina', 'Kaiser', 'Dune', 'Rovani', 'Zephyr', 'Corvo', 'Baltik', 'Aurum'];
const FNAMES = ['Cito', 'Compact', 'Family', 'Sedan', 'Touring', 'Ranch', 'Blaze', 'Falcon', 'Elegance', 'Sovereign',
  'Palace', 'Strada', 'Corsa', 'Apex', 'Vertex', 'Grand', 'Mistral', 'Nomad', 'Titan', 'Starlight'];
const CLASSES = [
  { k: 'base', light: 0.62, fwd: [29, 37], acc: [17, 23], price: [8500, 19000] },
  { k: 'moyen', light: 0.75, fwd: [37, 45], acc: [23, 30], price: [19000, 46000] },
  { k: 'luxe', light: 0.9, fwd: [45, 55], acc: [30, 37], price: [46000, 145000] },
  { k: 'ultra', light: 1.0, fwd: [55, 70], acc: [37, 46], price: [145000, 480000] }
];
const PAINTS = [0xc23b3b, 0x3b74c2, 0xd6d6dc, 0x2c2c34, 0xd7b23b, 0x3ba874, 0xb06ad0, 0xd97a35, 0x88919c,
  0x1a6f6f, 0x8f2850, 0x4a3418, 0x30425f, 0xe8e0c8, 0x551c8a, 0x0f7a3d, 0xd0d842, 0x222a38, 0xa83a1a, 0x60a0ff];
export const CATALOG = [];
const det = (n) => { const x = Math.sin(n * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };
for (let i = 0; i < 300; i++) {
  const cl = CLASSES[i < 120 ? 0 : i < 210 ? 1 : i < 272 ? 2 : 3];
  const brandIdx = i % 10;
  const fname = FNAMES[(i * 7 + brandIdx) % 20];
  const r1 = det(i * 2 + 1), r2 = det(i * 2 + 2), r3 = det(i * 3 + 5);
  const k = (a, b) => Math.round(a + (b - a) * r1);
  const kind = cl === CLASSES[3] ? 'sports' : kindOf(r2, cl);
  CATALOG.push({
    id: i, name: `${BRANDS[brandIdx]} ${fname}`, cls: cl.k, kind,
    w: 1.75 + r2 * 0.75, l: 3.55 + r3 * 2.15,
    color: PAINTS[(i * 11 + brandIdx) % PAINTS.length],
    cab: 0.42 + r3 * 0.16,
    maxFwd: k(cl.fwd[0], cl.fwd[1]),
    accel: Math.round(cl.acc[0] + (cl.acc[1] - cl.acc[0]) * r2),
    price: Math.round((cl.price[0] + (cl.price[1] - cl.price[0]) * r3) / 500) * 500
  });
}
function kindOf(r, cl) {
  if (cl === CLASSES[3]) return 'coupe';
  if (r > 0.85) return 'pickup';
  if (r > 0.65) return 'suv';
  if (r > 0.5) return 'coupe';
  return 'berline';
}
export function carType() {
  const r = Math.random();
  const i = r < 0.55 ? (Math.random() * 120) | 0 : r < 0.87 ? 120 + ((Math.random() * 90) | 0) : 210 + ((Math.random() * 90) | 0);
  return CATALOG[i];
}

const glassMat = new THREE.MeshStandardMaterial({ color: 0x0a1420, metalness: 0.9, roughness: 0.15 });
const darkMat = new THREE.MeshStandardMaterial({ color: 0x15151c, roughness: 0.7 });
const wheelGeo = new THREE.CylinderGeometry(0.38, 0.38, 0.34, 12);
wheelGeo.rotateZ(Math.PI / 2);

function asSpec(type) {
  if (typeof type === 'number') return CATALOG[type] || null;
  if (type && typeof type === 'object' && type.id !== undefined) return type;
  return null;
}

export function buildCarMesh(type) {
  const spec = asSpec(type);
  const t = spec || CARTYPES[type];
  const g = new THREE.Group();
  const paint = new THREE.MeshStandardMaterial({
    color: t.color !== null ? t.color : PALETTE[(Math.random() * PALETTE.length) | 0],
    metalness: spec && spec.cls !== 'base' ? 0.85 : 0.55,
    roughness: spec && (spec.cls === 'luxe' || spec.cls === 'ultra') ? 0.22 : 0.35
  });

  const body = new THREE.Mesh(new THREE.BoxGeometry(t.w, spec && (spec.kind === 'suv' || spec.kind === 'pickup') ? 0.8 : 0.6, t.l), paint);
  body.position.y = 0.55; body.castShadow = true; g.add(body);
  const cabin = new THREE.Mesh(new THREE.BoxGeometry(t.w * 0.86, spec && spec.kind === 'pickup' ? 0.42 : 0.52, t.l * (spec ? spec.cab : 0.45)), glassMat);
  cabin.position.set(0, 1.1, -t.l * 0.05); cabin.castShadow = true; g.add(cabin);

  const wheels = [];
  const wx = t.w / 2 - 0.05, wz = t.l / 2 - 0.85;
  for (const [x, z, front] of [[-wx, wz, true], [wx, wz, true], [-wx, -wz, false], [wx, -wz, false]]) {
    const w = new THREE.Mesh(wheelGeo, darkMat);
    w.position.set(x, 0.4, z); w.castShadow = true;
    w.rotation.order = 'YXZ';
    w.userData.front = front;
    g.add(w); wheels.push(w);
  }

  const tail = new THREE.Mesh(new THREE.BoxGeometry(t.w * 0.7, 0.14, 0.06),
    new THREE.MeshBasicMaterial({ color: 0xff2222, toneMapped: false, transparent: true, opacity: 0.7 }));
  tail.position.set(0, 0.72, -t.l / 2 - 0.02); g.add(tail);

  const head = new THREE.Mesh(new THREE.BoxGeometry(t.w * 0.7, 0.14, 0.06),
    new THREE.MeshBasicMaterial({ color: 0xfff2cc, toneMapped: false, transparent: true, opacity: 0.5 }));
  head.position.set(0, 0.72, t.l / 2 + 0.02); g.add(head);

  if (spec && (spec.cls === 'ultra' || spec.kind === 'coupe')) {
    const spo = new THREE.Mesh(new THREE.BoxGeometry(t.w * 0.8, 0.08, 0.34), paint);
    spo.position.set(0, 0.95, -t.l / 2 + 0.2);
    g.add(spo);
  }

  let lightbar = null;
  if (type === 'police' || type === 'army') {
    const bar = new THREE.Group();
    const r = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.16, 0.24),
      new THREE.MeshBasicMaterial({ color: 0xff2222, toneMapped: false }));
    r.position.x = -0.25;
    const b = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.16, 0.24),
      new THREE.MeshBasicMaterial({ color: 0x2266ff, toneMapped: false }));
    b.position.x = 0.25;
    bar.add(r); bar.add(b);
    bar.position.set(0, 1.45, -0.2);
    g.add(bar);
    lightbar = { group: bar, r: r.material, b: b.material };
    const stripe = new THREE.Mesh(new THREE.BoxGeometry(t.w + 0.03, 0.2, t.l * 0.25),
      new THREE.MeshBasicMaterial({ color: type === 'police' ? 0xffffff : 0x2e3a22 }));
    stripe.position.set(0, 0.55, 0);
    g.add(stripe);
  }
  return { group: g, wheels, paint, lightbar, headMat: head.material };
}

export class Vehicle {
  constructor(scene, type = 'sedan', pos = new THREE.Vector3(), heading = 0, ai = true) {
    const built = buildCarMesh(type);
    Object.assign(this, built);
    this.type = type;
    this.mesh = built.group;
    scene.add(this.mesh);
    this.pos = pos.clone();
    this.heading = heading;
    this.vf = 0; this.vl = 0; this.steer = 0; this.roll = 0;
    this.ai = ai;
    this.health = type === 'army' ? 220 : 100;
    this.wrecked = false;
    this.headlightsOn = false;
    const spec = asSpec(type);
    this.spec = spec;
    this.maxFwd = spec ? spec.maxFwd : (MAX_FWD[type] || 32);
    this.accel = spec ? spec.accel : (ACCEL[type] || 22);
    this.sync();
  }

  get speed() { return Math.abs(this.vf); }

  forward() { return new THREE.Vector3(Math.sin(this.heading), 0, Math.cos(this.heading)); }
  right() { return new THREE.Vector3(Math.cos(this.heading), 0, -Math.sin(this.heading)); }

  sync() {
    this.mesh.position.copy(this.pos);
    this.mesh.rotation.y = this.heading;
    this.mesh.rotation.z = this.roll;
  }

  drive(dt, input, colliders) {
    const fwd = this.forward(), rgt = this.right();
    const accel = input.throttle * this.accel - input.brakeInput * 46;
    this.vf += accel * dt;
    if (!input.throttle && !input.brakeInput) this.vf -= this.vf * 0.8 * dt;
    this.vf -= this.vf * 0.6 * dt;
    this.vf = Math.max(-14, Math.min(this.maxFwd + (input.boost ? 14 : 0), this.vf));

    const grip = input.handbrake ? 1.7 : 8.5;
    this.vl -= this.vl * Math.min(1, grip * dt);

    const steerTarget = input.steer * 0.6;
    this.steer += (steerTarget - this.steer) * Math.min(1, dt * 8);
    const sf = Math.min(Math.abs(this.vf) / 12, 1);
    this.heading += this.steer * Math.sign(this.vf || 1) * sf * 2.1 * dt * (input.handbrake ? 1.5 : 1);

    const vx = fwd.x * this.vf + rgt.x * this.vl;
    const vz = fwd.z * this.vf + rgt.z * this.vl;
    this.pos.x += vx * dt; this.pos.z += vz * dt;
    this.roll = -this.vl * 0.012;

    let crash = 0;
    for (const p of [1.5, -1.5]) {
      const px = this.pos.x + fwd.x * p, pz = this.pos.z + fwd.z * p;
      for (const c of colliders.near(px, pz)) {
        if (px > c.minX - 1.4 && px < c.maxX + 1.4 && pz > c.minZ - 1.4 && pz < c.maxZ + 1.4) {
          const push = [
            [c.maxX + 1.4 - px, 1, 0], [px - (c.minX - 1.4), -1, 0],
            [c.maxZ + 1.4 - pz, 0, 1], [pz - (c.minZ - 1.4), 0, -1]
          ].sort((a, b) => a[0] - b[0])[0];
          this.pos.x += push[1] * push[0]; this.pos.z += push[2] * push[0];
          const impact = Math.abs(this.vf);
          this.applyDamage(impact * 1.2);
          this.vf *= -0.25; this.vl *= 0.4;
          crash = impact;
        }
      }
    }
    this.pos.x = Math.max(-LIM, Math.min(LIM, this.pos.x));
    this.pos.z = Math.max(-LIM, Math.min(LIM, this.pos.z));

    const rollRate = this.vf * dt / 0.4;
    for (const w of this.wheels) {
      w.rotation.x += rollRate;
      if (w.userData.front) w.rotation.y = this.steer * 0.9;
    }
    this.sync();
    return { crash, skid: input.handbrake && this.speed > 8 };
  }

  kinematic(dt, target, speed, colliders) {
    if (this.wrecked) return 0;
    const dx = target.x - this.pos.x, dz = target.z - this.pos.z;
    const dist = Math.hypot(dx, dz);
    if (dist < 1.5) { this.vf = 0; this.sync(); return 0; }
    const targetAngle = Math.atan2(dx, dz);
    let diff = targetAngle - this.heading;
    while (diff > Math.PI) diff -= 2 * Math.PI;
    while (diff < -Math.PI) diff += 2 * Math.PI;
    const turnRate = 2.4;
    this.heading += Math.max(-turnRate * dt, Math.min(turnRate * dt, diff * dt * 3));
    const sp = Math.abs(diff) > 1.2 ? speed * 0.4 : speed;
    this.vf = sp;
    this.pos.x += Math.sin(this.heading) * sp * dt;
    this.pos.z += Math.cos(this.heading) * sp * dt;

    for (const c of (colliders ? colliders.near(this.pos.x, this.pos.z) : [])) {
      if (this.pos.x > c.minX - 1.6 && this.pos.x < c.maxX + 1.6 &&
          this.pos.z > c.minZ - 1.6 && this.pos.z < c.maxZ + 1.6) {
        const push = [
          [c.maxX + 1.6 - this.pos.x, 1, 0], [this.pos.x - (c.minX - 1.6), -1, 0],
          [c.maxZ + 1.6 - this.pos.z, 0, 1], [this.pos.z - (c.minZ - 1.6), 0, -1]
        ].sort((a, b) => a[0] - b[0])[0];
        this.pos.x += push[1] * push[0] * 0.25; this.pos.z += push[2] * push[0] * 0.25;
      }
    }
    const rollRate = sp * dt / 0.4;
    for (const w of this.wheels) w.rotation.x += rollRate;
    this.sync();
    return dist;
  }

  applyDamage(d) {
    if (this.wrecked) return 0;
    this.health -= d;
    if (this.health <= 0) { this.wreck(); return 1; }
    return 0;
  }

  wreck(fx, audio) {
    if (this.wrecked) return;
    this.wrecked = true;
    this.ai = false;
    this.paint.color.setHex(0x161616);
    this.headMat.color.setHex(0x222222);
    this.headMat.opacity = 0.1;
    if (fx) fx.explosion(this.pos);
    if (audio) audio.explosion();
  }

  dispose(scene) { scene.remove(this.mesh); }
}
