import * as THREE from 'three';

function bloodTexture() {
  const c = document.createElement('canvas'); c.width = c.height = 128;
  const ctx = c.getContext('2d');
  ctx.clearRect(0, 0, 128, 128);
  const g = ctx.createRadialGradient(64, 64, 4, 64, 64, 60);
  g.addColorStop(0, 'rgba(120, 8, 12, 0.95)');
  g.addColorStop(0.55, 'rgba(100, 5, 10, 0.6)');
  g.addColorStop(1, 'rgba(80, 0, 6, 0)');
  ctx.fillStyle = g;
  ctx.beginPath(); ctx.ellipse(64, 64, 58, 52, 0.4, 0, 7); ctx.fill();
  for (let i = 0; i < 26; i++) {
    const a = Math.random() * 7, r = 20 + Math.random() * 40;
    ctx.fillStyle = 'rgba(100,4,10,0.5)';
    ctx.beginPath();
    ctx.arc(64 + Math.cos(a) * r, 64 + Math.sin(a) * r, 2 + Math.random() * 6, 0, 7);
    ctx.fill();
  }
  return new THREE.CanvasTexture(c);
}

export class FX {
  constructor(scene) {
    this.scene = scene;
    this.tracers = [];
    this.booms = [];

    for (let i = 0; i < 16; i++) {
      const geo = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3(0, 0, 1)]);
      const mat = new THREE.LineBasicMaterial({ color: 0xffd080, transparent: true, opacity: 0 });
      const line = new THREE.Line(geo, mat);
      line.frustumCulled = false;
      scene.add(line);
      this.tracers.push({ line, mat, t: 0 });
    }

    const boomGeo = new THREE.SphereGeometry(1, 12, 8);
    for (let i = 0; i < 6; i++) {
      const mat = new THREE.MeshBasicMaterial({
        color: 0xffa040, transparent: true, opacity: 0,
        blending: THREE.AdditiveBlending, depthWrite: false
      });
      const m = new THREE.Mesh(boomGeo, mat);
      m.visible = false;
      scene.add(m);
      this.booms.push({ mesh: m, mat, t: 0, size: 1 });
    }

    /* --- particules de sang --- */
    const N = 320;
    this.bloodN = N;
    this.bloodPos = new Float32Array(N * 3);
    this.bloodVel = new Float32Array(N * 3);
    this.bloodLife = new Float32Array(N);
    this.bloodIdx = 0;
    const bg = new THREE.BufferGeometry();
    bg.setAttribute('position', new THREE.BufferAttribute(this.bloodPos, 3));
    this.bloodPts = new THREE.Points(bg, new THREE.PointsMaterial({
      color: 0x8a0f14, size: 0.16, sizeAttenuation: false, transparent: true, opacity: 0.95, depthWrite: false
    }));
    this.bloodPts.frustumCulled = false;
    scene.add(this.bloodPts);
    for (let i = 0; i < N; i++) this.bloodPos[i * 3 + 1] = -100;

    /* --- flaques / decals persistants --- */
    const D = 260;
    this.decals = new THREE.InstancedMesh(
      new THREE.PlaneGeometry(1.4, 1.4).rotateX(-Math.PI / 2),
      new THREE.MeshBasicMaterial({ map: bloodTexture(), transparent: true, depthWrite: false }),
      D
    );
    this.decals.renderOrder = 1;
    this.decals.frustumCulled = false;
    scene.add(this.decals);
    this.decIdx = 0;
    this.decCount = D;
    this.dummy = new THREE.Object3D();
    for (let i = 0; i < D; i++) {
      this.dummy.scale.setScalar(0);
      this.dummy.updateMatrix();
      this.decals.setMatrixAt(i, this.dummy.matrix);
    }
  }

  tracer(from, to, color = 0xffd080) {
    const slot = this.tracers.find(s => s.t <= 0) || this.tracers[0];
    const pos = slot.line.geometry.attributes.position;
    pos.setXYZ(0, from.x, from.y, from.z);
    pos.setXYZ(1, to.x, to.y, to.z);
    pos.needsUpdate = true;
    slot.mat.color.setHex(color);
    slot.mat.opacity = 0.9;
    slot.t = 0.09;
  }

  explosion(pos) {
    const slot = this.booms.find(s => s.t <= 0) || this.booms[0];
    slot.mesh.position.copy(pos); slot.mesh.position.y += 1;
    slot.mesh.visible = true;
    slot.mat.color.setHex(0xffa040);
    slot.mat.opacity = 1;
    slot.size = 2;
    slot.t = 0.7;
  }

  spark(pos) {
    const slot = this.booms.find(s => s.t <= 0) || this.booms[0];
    slot.mesh.position.copy(pos);
    slot.mesh.visible = true;
    slot.mat.color.setHex(0xffd040);
    slot.mat.opacity = 0.8;
    slot.size = 0.5;
    slot.t = 0.25;
  }

  /* projection de sang + flaque au sol */
  blood(pos, dir, n = 10) {
    for (let i = 0; i < n; i++) {
      const id = this.bloodIdx = (this.bloodIdx + 1) % this.bloodN;
      this.bloodPos[id * 3] = pos.x; this.bloodPos[id * 3 + 1] = pos.y; this.bloodPos[id * 3 + 2] = pos.z;
      const spread = 1.6;
      this.bloodVel[id * 3] = (dir ? dir.x * 2 : (Math.random() - 0.5) * 2) + (Math.random() - 0.5) * spread;
      this.bloodVel[id * 3 + 1] = 1.5 + Math.random() * 3;
      this.bloodVel[id * 3 + 2] = (dir ? dir.z * 2 : (Math.random() - 0.5) * 2) + (Math.random() - 0.5) * spread;
      this.bloodLife[id] = 1.4;
    }
    if (pos.y < 2) this.bloodPool(pos.x, pos.z, 0.7 + Math.random() * 0.6);
  }

  bloodPool(x, z, size) {
    const id = this.decIdx = (this.decIdx + 1) % this.decCount;
    this.dummy.position.set(x, 0.03 + (id % 7) * 0.002, z);
    this.dummy.rotation.set(0, 0, 0);
    this.dummy.rotation.y = Math.random() * Math.PI;
    this.dummy.scale.setScalar(size);
    this.dummy.updateMatrix();
    this.decals.setMatrixAt(id, this.dummy.matrix);
    this.decals.instanceMatrix.needsUpdate = true;
  }

  update(dt) {
    for (const s of this.tracers) {
      if (s.t > 0) {
        s.t -= dt;
        s.mat.opacity = Math.max(0, s.t / 0.09) * 0.9;
      }
    }
    for (const b of this.booms) {
      if (b.t > 0) {
        b.t -= dt;
        const k = 1 - b.t / 0.7;
        b.mesh.scale.setScalar(b.size * (0.4 + k * 2.6));
        b.mat.opacity = Math.max(0, 1 - k) * 0.9;
        if (b.t <= 0) b.mesh.visible = false;
      }
    }
    let dirty = false;
    for (let i = 0; i < this.bloodN; i++) {
      if (this.bloodLife[i] > 0) {
        this.bloodLife[i] -= dt;
        this.bloodPos[i * 3] += this.bloodVel[i * 3] * dt;
        this.bloodPos[i * 3 + 1] += this.bloodVel[i * 3 + 1] * dt;
        this.bloodPos[i * 3 + 2] += this.bloodVel[i * 3 + 2] * dt;
        this.bloodVel[i * 3 + 1] -= 12 * dt;
        if (this.bloodPos[i * 3 + 1] < 0.05) {
          this.bloodPos[i * 3 + 1] = -100;
          this.bloodLife[i] = 0;
          this.bloodPool(this.bloodPos[i * 3], this.bloodPos[i * 3 + 2], 0.25 + Math.random() * 0.3);
        }
        dirty = true;
      }
    }
    if (dirty) this.bloodPts.geometry.attributes.position.needsUpdate = true;
  }
}
