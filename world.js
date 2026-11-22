import * as THREE from 'three';

export const GRID = 20, BLOCK = 64, ROAD = 16;
export const P = BLOCK + ROAD;
export const WORLD = GRID * P + ROAD;
export const HALF = WORLD / 2;
export const rc = (k) => -HALF + k * P + ROAD / 2;
export const LIM = HALF + ROAD / 2 - 3;

export function snapRoad(v) {
  return Math.max(0, Math.min(GRID, Math.round((v + HALF - ROAD / 2) / P)));
}
export function nearestRoadPoint(x, z) {
  const kx = rc(snapRoad(x)), kz = rc(snapRoad(z));
  return Math.abs(x - kx) < Math.abs(z - kz)
    ? new THREE.Vector3(kx, 0, z) : new THREE.Vector3(x, 0, kz);
}
export function randomRoadPoint() {
  const k = (Math.random() * (GRID + 1)) | 0;
  const along = (Math.random() - 0.5) * (WORLD - 60);
  const off = (Math.random() - 0.5) * 8;
  return Math.random() < 0.5
    ? new THREE.Vector3(along, 0, rc(k) + off)
    : new THREE.Vector3(rc(k) + off, 0, along);
}

/* ---------- collisions : hash spatial ---------- */
export class Colliders {
  constructor() { this.cell = P; this.buckets = new Map(); }
  add(box) {
    for (let cx = Math.floor(box.minX / this.cell); cx <= Math.floor(box.maxX / this.cell); cx++)
      for (let cz = Math.floor(box.minZ / this.cell); cz <= Math.floor(box.maxZ / this.cell); cz++) {
        const k = cx + ',' + cz;
        if (!this.buckets.has(k)) this.buckets.set(k, []);
        this.buckets.get(k).push(box);
      }
  }
  near(x, z) {
    const out = [];
    const c = this.cell;
    for (let cx = Math.floor((x - 4) / c); cx <= Math.floor((x + 4) / c); cx++)
      for (let cz = Math.floor((z - 4) / c); cz <= Math.floor((z + 4) / c); cz++) {
        const b = this.buckets.get(cx + ',' + cz);
        if (b) out.push(...b);
      }
    return out;
  }
}

export function makeRayTester(colliders) {
  const p = new THREE.Vector3();
  return function blocked(origin, dir, dist) {
    for (let d = 2; d < dist; d += 2.5) {
      p.copy(origin).addScaledVector(dir, d);
      for (const b of colliders.near(p.x, p.z)) {
        if (p.x > b.minX && p.x < b.maxX && p.z > b.minZ && p.z < b.maxZ && p.y < b.h)
          return d;
      }
    }
    return dist;
  };
}

/* ---------- textures ---------- */
function makeCanvas(size) { const c = document.createElement('canvas'); c.width = c.height = size; return c; }

function drawCity(ctx, size, detailed) {
  const s = size / WORLD;
  const w2c = (v) => (v + HALF) * s;
  ctx.fillStyle = '#2a2a30'; ctx.fillRect(0, 0, size, size);
  for (let i = 0; i < GRID; i++) for (let j = 0; j < GRID; j++) {
    const x = w2c(-HALF + ROAD + i * P), z = w2c(-HALF + ROAD + j * P), bs = BLOCK * s;
    const beach = i === GRID - 1;
    const park = !beach && ((i * 7 + j * 13) % 13 === 4);
    const industry = !beach && !park && (i < 2 || j < 2);
    ctx.fillStyle = '#8d8d96'; ctx.fillRect(x, z, bs, bs);
    ctx.fillStyle = beach ? '#d8c08a' : park ? '#3f7a3d'
      : industry ? '#5c5c62'
      : ['#6e6e78', '#75756e', '#6a6a70', '#71716e'][(i * 3 + j * 5) % 4];
    const m = detailed ? 3 * s : 2;
    ctx.fillRect(x + m, z + m, bs - 2 * m, bs - 2 * m);
  }
  if (!detailed) return;
  ctx.strokeStyle = '#e8c33a'; ctx.lineWidth = Math.max(1, 0.4 * s);
  ctx.setLineDash([4 * s, 4 * s]);
  for (let k = 0; k <= GRID; k++) {
    const c = w2c(rc(k));
    ctx.beginPath(); ctx.moveTo(c, 0); ctx.lineTo(c, size); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(0, c); ctx.lineTo(size, c); ctx.stroke();
  }
  ctx.setLineDash([]);
}

function windowTextures() {
  const variants = [];
  const STYLES = [
    { base: '#565064', fond: '#a9c8dd', alt: '#7d93a6', lit: '#ffd27a' },
    { base: '#3d4352', fond: '#7d93a6', alt: '#57707f', lit: '#9fd8ff' },
    { base: '#7a6a58', fond: '#c9b18f', alt: '#a08a6c', lit: '#ffbe5c' },
    { base: '#2f333d', fond: '#3b4d63', alt: '#2c3a4a', lit: '#c8ecff' }
  ];
  for (let v = 0; v < STYLES.length; v++) {
    const st = STYLES[v];
    const W = 256, map = makeCanvas(W), lit = makeCanvas(W);
    const m = map.getContext('2d'), l = lit.getContext('2d');
    m.fillStyle = st.base; m.fillRect(0, 0, W, W);
    l.fillStyle = '#000'; l.fillRect(0, 0, W, W);
    m.fillStyle = 'rgba(0,0,0,0.18)';
    for (let y = 0; y < W; y += 32) m.fillRect(0, y + 30, W, 2);
    const cols = 8, rows = 10, cw = W / cols, ch = W / rows;
    for (let x = 0; x < cols; x++) for (let y = 0; y < rows; y++) {
      const px = x * cw + cw * 0.18, py = y * ch + ch * 0.2, pw = cw * 0.64, ph = ch * 0.55;
      m.fillStyle = Math.random() < 0.5 ? st.fond : st.alt; m.fillRect(px, py, pw, ph);
      m.fillStyle = 'rgba(255,255,255,0.28)'; m.fillRect(px, py, pw, 2);
      if (Math.random() < 0.4) {
        l.fillStyle = Math.random() < 0.75 ? st.lit : '#9fd8ff';
        l.fillRect(px, py, pw, ph);
      }
    }
    for (const c of [map, lit]) {
      const t = new THREE.CanvasTexture(c);
      t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping;
      variants.push(t);
    }
  }
  return variants;
}

function neonTexture(text, color) {
  const c = makeCanvas(512), ctx = c.getContext('2d');
  ctx.fillStyle = '#000'; ctx.fillRect(0, 0, 512, 512);
  ctx.font = '900 110px Arial'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.shadowColor = color; ctx.shadowBlur = 40;
  ctx.fillStyle = color; ctx.fillText(text, 256, 256);
  ctx.shadowBlur = 12; ctx.fillStyle = '#fff'; ctx.fillText(text, 256, 256);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function frondTexture() {
  const c = makeCanvas(128), ctx = c.getContext('2d');
  ctx.fillStyle = '#2f9e57';
  ctx.beginPath();
  ctx.moveTo(4, 64); ctx.quadraticCurveTo(60, 8, 124, 40);
  ctx.quadraticCurveTo(60, 40, 10, 70); ctx.closePath(); ctx.fill();
  ctx.beginPath();
  ctx.moveTo(4, 64); ctx.quadraticCurveTo(60, 120, 124, 88);
  ctx.quadraticCurveTo(60, 88, 10, 58); ctx.closePath(); ctx.fill();
  return new THREE.CanvasTexture(c);
}

function glowSpriteTexture() {
  const c = makeCanvas(64), ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(32, 32, 2, 32, 32, 32);
  g.addColorStop(0, 'rgba(255,230,160,1)'); g.addColorStop(0.4, 'rgba(255,190,80,0.35)');
  g.addColorStop(1, 'rgba(255,180,60,0)');
  ctx.fillStyle = g; ctx.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(c);
}

/* ---------- monde ---------- */
export function buildWorld(scene, getPlayerZ) {
  const group = new THREE.Group();
  scene.add(group);
  const colliders = new Colliders();
  const tallBuildings = [];

  const groundCanvas = makeCanvas(3072);
  drawCity(groundCanvas.getContext('2d'), 3072, true);
  const groundTex = new THREE.CanvasTexture(groundCanvas);
  groundTex.colorSpace = THREE.SRGBColorSpace; groundTex.anisotropy = 8;
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(WORLD, WORLD),
    new THREE.MeshStandardMaterial({ map: groundTex, roughness: 1 })
  );
  ground.rotation.x = -Math.PI / 2; ground.receiveShadow = true;
  group.add(ground);

  const farGround = new THREE.Mesh(new THREE.PlaneGeometry(6000, 6000),
    new THREE.MeshStandardMaterial({ color: 0x9a8a5f, roughness: 1 }));
  farGround.rotation.x = -Math.PI / 2; farGround.position.y = -0.15;
  group.add(farGround);

  const maps = windowTextures();
  const windowMats = [];
  for (let v = 0; v < maps.length / 2; v++) {
    windowMats.push(new THREE.MeshStandardMaterial({
      map: maps[v * 2], emissiveMap: maps[v * 2 + 1],
      emissive: 0xffffff, emissiveIntensity: 0, roughness: 0.85
    }));
  }
  const TINTS = [0xcfcfcf, 0xd8cbb4, 0xc4cfd8, 0xd4c0c0, 0xbfcfc2, 0xded6c2].map(c => new THREE.Color(c));

  const dummy = new THREE.Object3D();
  const builds = [[], [], [], []], roofs = [];
  const beachBlocks = [];
  const CENTER = (GRID - 1) / 2;

  for (let i = 0; i < GRID; i++) for (let j = 0; j < GRID; j++) {
    const bx = -HALF + ROAD + i * P, bz = -HALF + ROAD + j * P;
    if (i === GRID - 1) { beachBlocks.push([bx, bz]); continue; }
    if ((i * 7 + j * 13) % 13 === 4) continue;
    const dist = Math.hypot(i - CENTER, j - CENTER);
    const mul = dist < 3.2 ? 3.1 : dist < 6 ? 1.7 : dist < 9 ? 1.15 : 0.85;
    const cols = 2 + ((i + j) % 2), rows = 2 + ((i * 2 + j) % 2);
    const cw = BLOCK / cols, ch = BLOCK / rows;
    for (let a = 0; a < cols; a++) for (let b = 0; b < rows; b++) {
      if (Math.random() < 0.1) continue;
      const inset = 2 + Math.random() * 3;
      const cx = bx + a * cw + cw / 2, cz = bz + b * ch + ch / 2;
      const w = cw - inset * 2, d = ch - inset * 2;
      const h = Math.min(112, (9 + Math.random() * 15) * mul);
      builds[Math.floor(Math.random() * windowMats.length)].push({ cx, cz, w, d, h });
      roofs.push({ cx, cz, w, d, h });
      colliders.add({ minX: cx - w / 2, maxX: cx + w / 2, minZ: cz - d / 2, maxZ: cz + d / 2, h });
      if (h > 62) tallBuildings.push({ cx, cz, w, d, h });
    }
  }

  const boxGeo = new THREE.BoxGeometry(1, 1, 1);
  boxGeo.translate(0, 0.5, 0);
  for (let v = 0; v < windowMats.length; v++) {
    const list = builds[v];
    const inst = new THREE.InstancedMesh(boxGeo, windowMats[v], list.length);
    list.forEach((b, n) => {
      dummy.position.set(b.cx, 0, b.cz); dummy.scale.set(b.w, b.h, b.d);
      dummy.rotation.set(0, 0, 0); dummy.updateMatrix();
      inst.setMatrixAt(n, dummy.matrix);
      inst.setColorAt(n, TINTS[(Math.random() * TINTS.length) | 0]);
    });
    inst.castShadow = true; inst.receiveShadow = true;
    group.add(inst);
  }
  const roofInst = new THREE.InstancedMesh(boxGeo,
    new THREE.MeshStandardMaterial({ color: 0x2c2c34, roughness: 1 }), roofs.length);
  roofs.forEach((b, n) => {
    dummy.position.set(b.cx, b.h, b.cz); dummy.scale.set(b.w + 0.4, 0.6, b.d + 0.4);
    dummy.updateMatrix(); roofInst.setMatrixAt(n, dummy.matrix);
  });
  group.add(roofInst);

  const acs = roofs.filter(() => Math.random() < 0.55);
  const acGeo = new THREE.BoxGeometry(1, 1, 1);
  acGeo.translate(0, 0.5, 0);
  const acInst = new THREE.InstancedMesh(acGeo,
    new THREE.MeshStandardMaterial({ color: 0x8a8f96, roughness: 0.9, metalness: 0.3 }), acs.length);
  acs.forEach((b, n) => {
    dummy.position.set(b.cx + (Math.random() - 0.5) * Math.max(2, b.w - 5), b.h + 0.6, b.cz + (Math.random() - 0.5) * Math.max(2, b.d - 5));
    dummy.scale.set(1.6 + Math.random() * 1.4, 0.9 + Math.random() * 0.8, 1.4 + Math.random() * 1.6);
    dummy.rotation.set(0, Math.random() * Math.PI, 0);
    dummy.updateMatrix(); acInst.setMatrixAt(n, dummy.matrix);
  });
  dummy.rotation.set(0, 0, 0);
  group.add(acInst);

  const NEONS = ['VICE', 'PALM', 'OZ', 'CLUB', 'MOTEL', 'HOTEL', 'ROXY', 'NEON', '24H', 'BAR'];
  const NEONCOLORS = ['#ff2d95', '#35f0e0', '#ffb400', '#8f6bff'];
  tallBuildings.sort(() => Math.random() - 0.5);
  tallBuildings.slice(0, 20).forEach((b, n) => {
    const c = NEONCOLORS[n % NEONCOLORS.length];
    const sign = new THREE.Mesh(
      new THREE.PlaneGeometry(1.6, 9),
      new THREE.MeshBasicMaterial({
        map: neonTexture(NEONS[n % NEONS.length], c), transparent: true, toneMapped: false, side: THREE.DoubleSide
      })
    );
    const yaw = (n % 4) * Math.PI / 2;
    sign.position.set(
      b.cx + Math.sin(yaw) * (b.w / 2 + 0.4),
      16 + (b.h - 18) * 0.25,
      b.cz + Math.cos(yaw) * (b.d / 2 + 0.4)
    );
    sign.rotation.y = yaw;
    group.add(sign);
  });

  const lampPos = [];
  for (let k = 0; k <= GRID; k++) for (let m = 0; m <= GRID; m++)
    lampPos.push([rc(k) + 7.4, rc(m) + 7.4]);
  const poleGeo = new THREE.CylinderGeometry(0.12, 0.16, 6, 6);
  poleGeo.translate(0, 3, 0);
  const poles = new THREE.InstancedMesh(poleGeo,
    new THREE.MeshStandardMaterial({ color: 0x44505c, roughness: 0.7 }), lampPos.length);
  lampPos.forEach((p, n) => {
    dummy.position.set(p[0], 0, p[1]); dummy.scale.set(1, 1, 1);
    dummy.updateMatrix(); poles.setMatrixAt(n, dummy.matrix);
  });
  poles.castShadow = true;
  group.add(poles);

  const glowMat = new THREE.SpriteMaterial({
    map: glowSpriteTexture(), transparent: true, opacity: 0,
    blending: THREE.AdditiveBlending, depthWrite: false
  });
  const bulbMat = new THREE.MeshBasicMaterial({ color: 0xffe2a0, toneMapped: false, transparent: true, opacity: 0 });
  for (const p of lampPos) {
    const glow = new THREE.Sprite(glowMat);
    glow.position.set(p[0], 6, p[1]); glow.scale.set(4.5, 4.5, 1);
    group.add(glow);
    const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.25, 8, 6), bulbMat);
    bulb.position.set(p[0], 6, p[1]);
    group.add(bulb);
  }

  const palmXZ = [];
  for (const [bx, bz] of beachBlocks)
    for (let n = 0; n < 8; n++)
      palmXZ.push([bx + 6 + Math.random() * (BLOCK - 12), bz + 6 + Math.random() * (BLOCK - 12)]);
  for (let k = 0; k <= GRID; k++) for (let m = 0; m <= GRID; m++)
    if (Math.random() < 0.15) palmXZ.push([rc(k) - ROAD / 2 - 2.5, rc(m) - ROAD / 2 - 2.5]);
  const trunkGeo = new THREE.CylinderGeometry(0.16, 0.3, 6, 6);
  trunkGeo.translate(0, 3, 0);
  const trunks = new THREE.InstancedMesh(trunkGeo,
    new THREE.MeshStandardMaterial({ color: 0x8a6a43, roughness: 1 }), palmXZ.length);
  const fronds = new THREE.InstancedMesh(new THREE.PlaneGeometry(7, 3.4),
    new THREE.MeshStandardMaterial({
      map: frondTexture(), transparent: true, alphaTest: 0.4, side: THREE.DoubleSide, roughness: 1
    }), palmXZ.length * 6);
  let frondIdx = 0;
  palmXZ.forEach((p, n) => {
    const sc = 0.8 + Math.random() * 0.6;
    dummy.position.set(p[0], 0, p[1]); dummy.scale.set(sc, sc, sc);
    dummy.rotation.set(0, Math.random() * Math.PI, 0); dummy.updateMatrix();
    trunks.setMatrixAt(n, dummy.matrix);
    for (let f = 0; f < 6; f++) {
      dummy.position.set(p[0], 6 * sc, p[1]);
      dummy.rotation.set(-0.7, (f / 6) * Math.PI * 2 + Math.random() * 0.4, 0);
      dummy.scale.set(sc, sc, sc); dummy.updateMatrix();
      fronds.setMatrixAt(frondIdx++, dummy.matrix);
    }
  });
  trunks.castShadow = true;
  group.add(trunks); group.add(fronds);

  const waterGeo = new THREE.PlaneGeometry(4000, 2600, 48, 24);
  waterGeo.rotateX(-Math.PI / 2);
  const water = new THREE.Mesh(waterGeo, new THREE.MeshStandardMaterial({
    color: 0x0d6e93, roughness: 0.25, metalness: 0.5, transparent: true, opacity: 0.96
  }));
  water.position.set(HALF + 1990, -0.4, 0);
  group.add(water);
  const beachStrip = new THREE.Mesh(new THREE.PlaneGeometry(90, WORLD + 400),
    new THREE.MeshStandardMaterial({ color: 0xd8c08a, roughness: 1 }));
  beachStrip.rotation.x = -Math.PI / 2;
  beachStrip.position.set(HALF + 40, -0.05, 0);
  group.add(beachStrip);

  const starGeo = new THREE.BufferGeometry();
  const sp = [];
  for (let n = 0; n < 900; n++) {
    const th = Math.random() * Math.PI * 2, ph = Math.random() * Math.PI * 0.45;
    sp.push(Math.cos(th) * Math.cos(ph) * 1400, Math.sin(ph) * 1400 + 50, Math.sin(th) * Math.cos(ph) * 1400);
  }
  starGeo.setAttribute('position', new THREE.Float32BufferAttribute(sp, 3));
  const starMat = new THREE.PointsMaterial({
    color: 0xffffff, size: 2, sizeAttenuation: false, transparent: true, opacity: 0, depthWrite: false
  });
  const stars = new THREE.Points(starGeo, starMat);
  stars.renderOrder = -1;
  group.add(stars);

  const skyMat = new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, fog: false,
    uniforms: {
      topColor: { value: new THREE.Color(0x2074c8) },
      horizonColor: { value: new THREE.Color(0xbcd9ec) },
      sunDir: { value: new THREE.Vector3(0.5, 0.8, 0.3) }
    },
    vertexShader: `
      varying vec3 vDir;
      void main(){ vDir = normalize(position);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: `
      uniform vec3 topColor; uniform vec3 horizonColor; uniform vec3 sunDir;
      varying vec3 vDir;
      void main(){
        float h = max(vDir.y, 0.0);
        vec3 col = mix(horizonColor, topColor, pow(h, 0.55));
        vec3 sd = normalize(sunDir);
        float d = max(dot(normalize(vDir), sd), 0.0);
        col += vec3(1.0, 0.85, 0.6) * (pow(d, 320.0) * 1.6 + pow(d, 8.0) * 0.22);
        gl_FragColor = vec4(col, 1.0);
      }`
  });
  const sky = new THREE.Mesh(new THREE.SphereGeometry(1500, 24, 12), skyMat);
  sky.renderOrder = -2;
  group.add(sky);

  const minimapCanvas = makeCanvas(384);
  drawCity(minimapCanvas.getContext('2d'), 384, false);

  /* ---------- portes ouvrables sur les rez-de-chaussée ---------- */
  const doorGeo = new THREE.BoxGeometry(1.5, 2.5, 0.14);
  doorGeo.translate(0.78, 1.25, 0);
  const doorMat = new THREE.MeshStandardMaterial({ color: 0x5c3d24, roughness: 0.6, metalness: 0.15 });
  const allBuilds = builds.flat();
  const doors = [];
  const doorCenters = [];
  for (let i = 0; i < allBuilds.length && doors.length < 90; i++) {
    if (Math.random() > 0.16) continue;
    const b = allBuilds[i];
    const kx = Math.max(0, Math.min(GRID, Math.round((b.cx + HALF - ROAD / 2) / P)));
    const kz = Math.max(0, Math.min(GRID, Math.round((b.cz + HALF - ROAD / 2) / P)));
    const dxv = Math.abs(b.cx - rc(kx)), dzv = Math.abs(b.cz - rc(kz));
    let n, perp, baseYaw, halfW;
    if (dxv * (dxv < dzv ? 1 : 0) <= dzv) {
      const sgn = Math.sign(rc(kx) - b.cx) || 1;
      n = { x: sgn, z: 0 }; perp = { x: 0, z: 1 };
      baseYaw = sgn > 0 ? Math.PI / 2 : -Math.PI / 2;
      halfW = b.d / 2;
    } else {
      const sgn = Math.sign(rc(kz) - b.cz) || 1;
      n = { x: 0, z: sgn }; perp = { x: 1, z: 0 };
      baseYaw = sgn > 0 ? 0 : Math.PI;
      halfW = b.w / 2;
    }
    const fx = b.cx + n.x * halfW, fz = b.cz + n.z * halfW;
    const off = (Math.random() - 0.5) * Math.max(1, halfW * 2 - 3);
    const hingeX = fx - perp.x * 0.25 + perp.x * off + n.x * 0.09;
    const hingeZ = fz - perp.z * 0.25 + perp.z * off + n.z * 0.09;
    if (Math.abs(hingeX) > LIM - 2 || Math.abs(hingeZ) > LIM - 2) continue;
    doors.push({ x: hingeX, z: hingeZ, yaw: baseYaw, open: 0, target: 0 });
    doorCenters.push([hingeX + Math.sin(baseYaw) * 0.78, hingeZ + Math.cos(baseYaw) * 0.25, baseYaw]);
  }
  const doorsInst = new THREE.InstancedMesh(doorGeo, doorMat, doors.length);
  doorsInst.castShadow = true;
  doors.forEach((d, i) => {
    dummy.position.set(d.x, 0.02, d.z);
    dummy.rotation.set(0, d.yaw, 0); dummy.scale.set(1, 1, 1);
    dummy.updateMatrix(); doorsInst.setMatrixAt(i, dummy.matrix);
  });
  group.add(doorsInst);

  function doorsUpdate(dt) {
    let dirty = false;
    for (let i = 0; i < doors.length; i++) {
      const d = doors[i];
      if (Math.abs(d.open - d.target) > 0.01) {
        d.open += Math.sign(d.target - d.open) * dt * 1.8;
        d.open = Math.max(0, Math.min(1, d.open));
        dummy.position.set(d.x, 0.02, d.z);
        dummy.rotation.set(0, d.yaw + d.open * 1.85, 0);
        dummy.scale.set(1, 1, 1); dummy.updateMatrix();
        doorsInst.setMatrixAt(i, dummy.matrix);
        dirty = true;
      }
    }
    if (dirty) doorsInst.instanceMatrix.needsUpdate = true;
  }

  function doorNearest(pos, r = 3) {
    let best = null, bd = r;
    for (const d of doors) {
      const dist = Math.hypot(d.x - pos.x, d.z - pos.z);
      if (dist < bd) { bd = dist; best = d; }
    }
    return best;
  }

  /* ---------- immobilier ---------- */
  function propTexture(text, color) {
    const c = makeCanvas(256), ctx = c.getContext('2d');
    ctx.fillStyle = '#12081f'; ctx.fillRect(0, 0, 256, 256);
    ctx.strokeStyle = color; ctx.lineWidth = 10; ctx.strokeRect(8, 8, 240, 240);
    ctx.font = '900 64px Arial'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillStyle = color; ctx.shadowColor = color; ctx.shadowBlur = 24;
    ctx.fillText('À VENDRE', 128, 92);
    ctx.font = '900 44px Arial';
    ctx.fillStyle = '#fdfdfd'; ctx.shadowColor = '#fdfdfd';
    ctx.fillText(text, 128, 178);
    const tx = new THREE.CanvasTexture(c); tx.colorSpace = THREE.SRGBColorSpace;
    return tx;
  }

  const propMarkers2 = [];
  const HOODS = ['Palma', 'Sunset', 'Cove', 'Marina', 'Heights', 'Grove', 'Dune', 'Port'];
  const HOUSE_KINDS = [
    { type: 'maison', price: [14000, 24000] },
    { type: 'studio', price: [11000, 18000] },
    { type: 'appartement', price: [26000, 92000] },
    { type: 'villa', price: [45000, 180000] }
  ];
  const PROPERTIES = [
    { name: 'Villa Palm Cove', price: 45000, type: 'villa', x: HALF - 55, z: rc(12), owned: false },
    { name: 'Penthouse Néon', price: 88000, type: 'appartement', x: rc(8) + 13, z: rc(7) + 9, owned: false },
    { name: 'Loft Art District', price: 32000, type: 'appartement', x: rc(3) - 9, z: rc(9) + 13, owned: false },
    { name: 'Maison Palm Row', price: 18000, type: 'maison', x: rc(11) + 13, z: rc(4) - 9, owned: false },
    { name: 'Bungalow Sunrise', price: 26000, type: 'maison', x: rc(13) - 9, z: rc(10) + 13, owned: false },
    { name: 'Studio Centre', price: 14000, type: 'studio', x: rc(6) - 13, z: rc(12) - 9, owned: false }
  ];
  const qrand = (() => { let s = 42; return () => { s = (s * 16807) % 2147483647; return (s % 10000) / 10000; }; })();
  for (let n = 0; n < 114; n++) {
    const kind = HOUSE_KINDS[n % 4];
    const hood = HOODS[n % HOODS.length];
    const a = 2 + ((qrand() * (GRID - 4)) | 0), b = 2 + ((qrand() * (GRID - 4)) | 0);
    const sideX = qrand() < 0.5 ? 13 : -13, sideZ = qrand() < 0.5 ? 9 : -9;
    const price = Math.round((kind.price[0] + qrand() * (kind.price[1] - kind.price[0])) / 500) * 500;
    const names = kind.type === 'villa' ? ['Villa'] : kind.type === 'appartement' ? ['Appart', 'Penthouse', 'Loft']
      : kind.type === 'studio' ? ['Studio'] : ['Maison', 'Bungalow', 'Pavillon'];
    PROPERTIES.push({
      name: `${names[n % names.length]} ${hood} ${1 + ((n / HOODS.length) | 0)}`,
      price, type: kind.type,
      x: rc(Math.min(GRID, a)) + sideX, z: rc(Math.min(GRID, b)) + sideZ,
      owned: false
    });
  }
  PROPERTIES.forEach((pr, i) => {
    const group = new THREE.Group();
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.08, 3.4, 6),
      new THREE.MeshStandardMaterial({ color: 0x8a8a92 }));
    pole.position.y = 1.7; group.add(pole);
    const sign = new THREE.Mesh(new THREE.PlaneGeometry(3, 3),
      new THREE.MeshBasicMaterial({ map: propTexture(pr.price.toLocaleString('fr-FR') + ' $', '#ffd23c'), side: THREE.DoubleSide, toneMapped: false, transparent: false }));
    sign.position.y = 4; group.add(sign);
    group.position.set(pr.x, 0, pr.z);
    group.rotation.y = Math.random() * Math.PI;
    scene.add(group);
    propMarkers2.push({ group, sign, i, pr });
    pr.marker = group; pr.sign = sign;
  });

  function propNearest(pos, r = 5) {
    let best = null, bd = r;
    for (const pr of PROPERTIES) {
      const dist = Math.hypot(pr.x - pos.x, pr.z - pos.z);
      if (dist < bd) { bd = dist; best = pr; }
    }
    return best;
  }

  function soldProp(pr) {
    pr.owned = true;
    if (pr.sign) {
      pr.sign.material.map.dispose();
      pr.sign.material.map = propTexture('CHEZ TOI 💚', '#35f0e0');
      pr.sign.material.needsUpdate = true;
    }
  }

  let dtPassthrough = 0;
  function setDt(v) { dtPassthrough = v; }

  const baseWater = waterGeo.attributes.position.array.slice();

  function update(t, night, playerZ) {
    doorsUpdate(dtPassthrough || 0.016);
    for (const pm of propMarkers2) {
      pm.group.rotation.y = t * 0.25;
      pm.group.position.y = 2.4 + Math.sin(t * 2 + pm.i) * 0.25;
    }
    const pos = waterGeo.attributes.position;
    for (let n = 0; n < pos.count; n++) {
      const x = baseWater[n * 3], z = baseWater[n * 3 + 2];
      pos.setY(n, Math.sin(x * 0.05 + t * 1.4) * 0.5 + Math.cos(z * 0.04 + t) * 0.4);
    }
    pos.needsUpdate = true;
    if (playerZ !== undefined) water.position.z = playerZ;
    sky.position.set(sky.position.x, 0, sky.position.z);
    glowMat.opacity = night * 0.9;
    bulbMat.opacity = night;
    starMat.opacity = night * 0.9;
    for (const m of windowMats) m.emissiveIntensity = night * 1.5;
  }

  const skyState = { mesh: sky, mat: skyMat };

  return { colliders, minimapCanvas, windowMats, update, skyState, setDt, doorNearest, toggleDoor: null, PROPERTIES, propNearest, soldProp, doors };
}
