import * as THREE from 'three';
import { Vehicle, carType } from './vehicles.js';
import { rc, GRID, randomRoadPoint } from './world.js';

const LANE = 4;
const DIRS = [{ x: 1, z: 0 }, { x: -1, z: 0 }, { x: 0, z: 1 }, { x: 0, z: -1 }];
const right = (d) => ({ x: d.z, z: -d.x });

export class Traffic {
  constructor(scene, colliders, count = 28, parkedCount = 24) {
    this.scene = scene;
    this.colliders = colliders;
    this.vehicles = [];
    this.parked = [];
    for (let n = 0; n < count; n++) {
      const type = Math.random() < 0.12 ? 'sports' : Math.random() < 0.2 ? 'taxi' : carType();
      const v = new Vehicle(scene, type, randomRoadPoint(), Math.random() * Math.PI * 2);
      this.spawnRoute(v, true);
      this.vehicles.push(v);
    }
    for (let n = 0; n < parkedCount; n++) {
      const v = new Vehicle(scene, carType(), this.parkPos(), Math.random() < 0.5 ? 0 : Math.PI / 2, false);
      this.parked.push(v);
    }
  }

  parkPos() {
    const p = randomRoadPoint();
    p.x += 6.6 * (Math.random() < 0.5 ? 1 : -1);
    p.z += 6.6 * (Math.random() < 0.5 ? 1 : -1);
    return p;
  }

  spawnRoute(v, initial = false) {
    const node = {
      m: 1 + ((Math.random() * (GRID - 1)) | 0),
      n: 1 + ((Math.random() * (GRID - 1)) | 0)
    };
    v.dir = DIRS[(Math.random() * 4) | 0];
    const r = right(v.dir);
    v.node = node;
    const m = Math.min(GRID, Math.max(0, node.m + v.dir.x));
    const n = Math.min(GRID, Math.max(0, node.n + v.dir.z));
    v.node = { m, n };
    v.target = new THREE.Vector3(rc(m) + r.x * LANE * 0, 0, rc(n) + r.z * LANE);
    v.target.x = rc(m) + r.x * LANE;
    if (initial && v.pos.distanceTo(v.target) > 110) {
      v.pos.set(v.target.x - v.dir.x * 40 + r.x * LANE * 0, 0,
        v.target.z - v.dir.z * 40 + r.z * LANE);
      v.pos.x = v.target.x - v.dir.x * 40 + r.x * LANE;
    }
  }

  nodeNext(v) {
    const node = v.node;
    const cands = DIRS.filter(d => !(d.x === -v.dir.x && d.z === -v.dir.z))
      .filter(d => {
        const m = node.m + d.x, n = node.n + d.z;
        return m >= 0 && m <= GRID && n >= 0 && n <= GRID;
      });
    if (!cands.length) v.dir = { x: -v.dir.x, z: -v.dir.z };
    else {
      const straight = cands.find(d => d.x === v.dir.x && d.z === v.dir.z);
      v.dir = (straight && Math.random() < 0.6) ? straight : cands[(Math.random() * cands.length) | 0];
    }
    const m = Math.min(GRID, Math.max(0, node.m + v.dir.x));
    const n = Math.min(GRID, Math.max(0, node.n + v.dir.z));
    v.node = { m, n };
    const r = right(v.dir);
    v.target.set(rc(m) + r.x * LANE, 0, rc(n) + r.z * LANE);
  }

  update(dt, player) {
    let blockedByPlayer = 0;
    for (const v of this.vehicles) {
      if (!v.ai || v.wrecked) continue;
      if (v.stopped && v.stopped > 0) { v.stopped -= dt; v.vf = 0; continue; }
      const to = new THREE.Vector3().subVectors(v.target, v.pos); to.y = 0;
      if (to.length() < 3) this.nodeNext(v);

      let speed = v.type === 'sports' ? 16 : 10;
      if (player) {
        const dx = player.pos.x - v.pos.x, dz = player.pos.z - v.pos.z;
        const pd = Math.hypot(dx, dz);
        const fwd = v.forward();
        if (pd < 11 && (fwd.x * dx + fwd.z * dz) / Math.max(pd, 0.01) > 0.65) {
          speed = 0; blockedByPlayer++;
        }
      }
      if (speed > 0) v.kinematic(dt, v.target, speed, this.colliders);
      else { v.vf = 0; v.sync(); }
    }
    return blockedByPlayer;
  }

  remove(v) {
    const i = this.vehicles.indexOf(v);
    if (i >= 0) this.vehicles.splice(i, 1);
  }
}
