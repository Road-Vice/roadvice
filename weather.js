import * as THREE from 'three';

const TYPES = [
  { name: 'Clair', icon: '☀️', fog: 1.0, light: 1.0, rain: 0, snow: 0, wind: 2 },
  { name: 'Nuageux', icon: '⛅', fog: 1.3, light: 0.85, rain: 0, snow: 0, wind: 4 },
  { name: 'Vent', icon: '🌬️', fog: 1.1, light: 0.95, rain: 0, snow: 0, wind: 16 },
  { name: 'Pluie', icon: '🌧️', fog: 2.0, light: 0.6, rain: 1700, snow: 0, wind: 7 },
  { name: 'Orage', icon: '⛈️', fog: 2.7, light: 0.4, rain: 2600, snow: 0, wind: 11, lightning: true },
  { name: 'Neige', icon: '🌨️', fog: 2.3, light: 0.72, rain: 0, snow: 1500, wind: 3 },
  { name: 'Brouillard', icon: '🌫️', fog: 4.3, light: 0.68, rain: 0, snow: 0, wind: 1 }
];

const RANGE = 85, HMAX = 55;

function makeLayer(n, size, color, opacity, additive) {
  const geo = new THREE.BufferGeometry();
  const pos = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    pos[i * 3] = (Math.random() * 2 - 1) * RANGE;
    pos[i * 3 + 1] = Math.random() * HMAX;
    pos[i * 3 + 2] = (Math.random() * 2 - 1) * RANGE;
  }
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setDrawRange(0, 0);
  const mat = new THREE.PointsMaterial({
    color, size, transparent: true, opacity,
    depthWrite: false, toneMapped: false,
    blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending
  });
  const points = new THREE.Points(geo, mat);
  points.frustumCulled = false;
  return { points, pos, n, live: 0 };
}

export class Weather {
  constructor(scene) {
    this.types = TYPES;
    this.idx = 0;
    this.label = TYPES[0];
    this.timer = 30 + Math.random() * 40;
    this.rain = makeLayer(2600, 0.34, 0xa9c4e8, 0.6, true);
    this.snow = makeLayer(1500, 0.5, 0xf4f8ff, 0.9, false);
    this.rain.points.visible = false;
    this.snow.points.visible = false;
    scene.add(this.rain.points); scene.add(this.snow.points);
    this.intensity = 0;
    this.flash = 0;
    this.onThunder = null;
    this.notify = null;
  }

  next() {
    this.timer = 45 + Math.random() * 75;
    this.idx = Math.random() < 0.55 ? 0 : 1 + ((Math.random() * (TYPES.length - 1)) | 0);
    this.label = TYPES[this.idx];
    if (this.notify) this.notify(`Météo : ${this.label.icon} ${this.label.name}`);
  }

  set(idx) {
    this.idx = Math.max(0, Math.min(TYPES.length - 1, idx));
    this.label = TYPES[this.idx];
    this.timer = 45 + Math.random() * 75;
    if (this.notify) this.notify(`Météo : ${this.label.icon} ${this.label.name}`);
  }

  update(dt, playerPos) {
    const T = this.label;
    const target = Math.max(T.rain > 0 ? T.rain : T.snow, 1) / (T.rain ? this.rain.n : (T.snow ? this.snow.n : 1));
    const tgt = (T.rain > 0 || T.snow > 0) ? target : 0;
    this.intensity += (tgt - this.intensity) * Math.min(1, dt * 0.5);
    this.timer -= dt;
    if (this.timer <= 0) this.next();

    this.rain.points.visible = this.intensity > 0.02 && T.rain > 0;
    this.snow.points.visible = this.intensity > 0.02 && T.snow > 0;
    this.rain.points.geometry.setDrawRange(0, Math.floor(this.rain.n * this.intensity));
    this.snow.points.geometry.setDrawRange(0, Math.floor(this.snow.n * this.intensity));

    if (T.lightning) {
      this.flash = Math.max(0, this.flash - dt * 3.2);
      if (Math.random() < dt * 0.25) {
        this.flash = 1;
        if (this.onThunder) this.onThunder();
      }
    } else this.flash = 0;

    if (!(this.rain.points.visible || this.snow.points.visible)) return;
    const windX = T.wind * 0.45;
    for (const layer of [this.rain, this.snow]) {
      if (!layer.points.visible) continue;
      const speed = T.snow ? 4.5 : 28;
      const p = layer.pos;
      const count = layer.points.geometry.drawRange.count;
      for (let i = 0; i < count; i++) {
        p[i * 3 + 1] -= speed * dt * (0.8 + (i % 7) * 0.05);
        p[i * 3] += (windX + (T.snow ? Math.sin(i + performance.now() / 700) * 1.6 : 0)) * dt;
        if (p[i * 3 + 1] < 0) {
          p[i * 3 + 1] = HMAX * (0.7 + Math.random() * 0.3);
          p[i * 3] = (Math.random() * 2 - 1) * RANGE;
          p[i * 3 + 2] = (Math.random() * 2 - 1) * RANGE;
        }
      }
      layer.points.geometry.attributes.position.needsUpdate = true;
      layer.points.position.set(playerPos.x, 0, playerPos.z);
    }
  }
}
