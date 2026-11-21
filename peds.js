import * as THREE from 'three';
import { rc, GRID, randomRoadPoint, HALF } from './world.js';

const GANG = { x0: -HALF + 96, x1: -HALF + 336, z0: -HALF + 96, z1: -HALF + 336 };
export const GANG_ZONE = GANG;
const SWIM = [0xff5588, 0x33ccbb, 0xffe066, 0x5588ff, 0xff8c55, 0xffffff];
export const BEACH_X = HALF - 26;
import { crowdTorsoGeometry, crowdHeadGeometry, crowdLegGeometry, SKINS, SHIRTS, PANTS } from './characters.js';

const SIDE = 9.6;
const DIRS = [{ x: 1, z: 0 }, { x: -1, z: 0 }, { x: 0, z: 1 }, { x: 0, z: -1 }];

export class Peds {
  constructor(scene, count = 130) {
    this.count = count;
    this.active = count;
    this.torso = new THREE.InstancedMesh(crowdTorsoGeometry(),
      new THREE.MeshStandardMaterial({ roughness: 0.85 }), count);
    this.head = new THREE.InstancedMesh(crowdHeadGeometry(),
      new THREE.MeshStandardMaterial({ roughness: 0.75 }), count);
    this.legs = new THREE.InstancedMesh(crowdLegGeometry(),
      new THREE.MeshStandardMaterial({ roughness: 0.85 }), count * 2);
    this.torso.castShadow = true; this.legs.castShadow = true;
    scene.add(this.torso); scene.add(this.head); scene.add(this.legs);

    this.list = [];
    const c = new THREE.Color();
    for (let n = 0; n < count; n++) {
      const ped = {
        pos: this.spawnPos(), heading: Math.random() * Math.PI * 2,
        target: null, dirPick: DIRS[(Math.random() * 4) | 0],
        phase: Math.random() * 10,
        jogger: Math.random() < 0.18,
        state: 'walk', stateT: 0,
        health: 40, flinchT: 0, flyVel: null,
        dead: false, deadT: 30, deadAnim: 0, hidden: false,
        shirt: SHIRTS[(Math.random() * SHIRTS.length) | 0],
        skin: SKINS[(Math.random() * SKINS.length) | 0],
        pants: PANTS[(Math.random() * PANTS.length) | 0],
        partner: null,
        aggressive: false, spouse: false, sunbathe: false, atkT: 0
      };
      if (ped.pos.x > BEACH_X && Math.random() < 0.55) {
        ped.sunbathe = true;
        ped.pos.x = BEACH_X + 4 + Math.random() * 12;
        ped.pos.z = -HALF + 120 + Math.random() * (2 * HALF - 240);
        ped.shirt = ped.skin;
        ped.pants = SWIM[(Math.random() * SWIM.length) | 0];
      } else if (ped.pos.x > GANG.x0 && ped.pos.x < GANG.x1 && ped.pos.z > GANG.z0 && ped.pos.z < GANG.z1) {
        ped.aggressive = Math.random() < 0.55;
        if (ped.aggressive) { ped.shirt = 0x5a2a96; ped.health = 72; }
      }
      this.pickTarget(ped, true);
      this.list.push(ped);
      this.torso.setColorAt(n, c.setHex(ped.shirt));
      this.head.setColorAt(n, c.setHex(ped.skin));
      this.legs.setColorAt(n * 2, c.setHex(ped.pants));
      this.legs.setColorAt(n * 2 + 1, c.setHex(ped.pants));
    }
    this.sub = new THREE.Object3D();
    this.root = new THREE.Matrix4();
    this.local = new THREE.Matrix4();
    this.zero = new THREE.Matrix4().makeScale(0, 0, 0);
  }

  spawnPos() {
    const p = randomRoadPoint();
    p.x += (Math.random() < 0.5 ? -1 : 1) * (SIDE - 8 + 1.6);
    p.z += (Math.random() < 0.5 ? -1 : 1) * (SIDE - 8 + 1.6);
    return p;
  }

  pickTarget(ped, initial = false) {
    const P = 80, OFF = rc(1) - rc(0);
    const m = Math.min(GRID, Math.max(0, Math.round((ped.pos.x + HALF - 8) / P)));
    const k = Math.min(GRID, Math.max(0, Math.round((ped.pos.z + HALF - 8) / P)));
    let d = ped.dirPick || DIRS[(Math.random() * 4) | 0];
    if (!initial && Math.random() < 0.55) {
      const cands = DIRS.filter(x => !(x.x === -d.x && x.z === -d.z));
      d = cands[(Math.random() * cands.length) | 0];
    }
    ped.dirPick = d;
    const tx = rc(Math.min(GRID, Math.max(0, m + d.x))) + d.x * SIDE;
    const tz = rc(Math.min(GRID, Math.max(0, k + d.z))) + d.z * SIDE;
    ped.target = new THREE.Vector3(tx, 0, tz);
  }

  hitPed(ped, dmg, impulse, byPlayer) {
    if (ped.dead) return;
    ped.health -= dmg;
    if (ped.health <= 0) {
      this.kill(ped, byPlayer);
      return;
    }
    ped.flinchT = 0.5;
    this.panicPed(ped, 5);
    if (impulse) {
      ped.pos.addScaledVector(impulse, 0.6);
    }
  }

  kill(ped, byPlayer) {
    if (ped.dead) return;
    ped.dead = true;
    ped.deadT = 30;
    ped.state = 'dead';
    if (this.onDeath) this.onDeath(ped, byPlayer);
  }

  beachPos() {
    return new THREE.Vector3(BEACH_X + 4 + Math.random() * 12, 0, -HALF + 120 + Math.random() * (2 * HALF - 240));
  }

  panicPed(ped, dur = 5) {
    if (ped.dead || ped.flinchT > 0) return;
    ped.state = 'panic';
    ped.stateT = dur;
  }

  panic(pos, radius = 24, audio = null) {
    let screamed = 0;
    for (const ped of this.list) {
      if (ped.dead) continue;
      const d = ped.pos.distanceTo(pos);
      if (d < radius) {
        this.panicPed(ped, 4 + Math.random() * 3);
        if (audio && screamed < 2 && Math.random() < 0.4) { audio.yelp(); screamed++; }
      }
    }
  }

  update(dt, player, noise) {
    const sub = this.sub, root = this.root, local = this.local;
    let idx = 0;
    for (let n = 0; n < this.count; n++) {
      const ped = this.list[n];

      if (ped.dead) {
        if (ped.flyVel) {
          ped.pos.addScaledVector(ped.flyVel, dt);
          ped.flyVel.y -= 14 * dt;
          ped.pos.y += 0;
          if (ped.pos.y <= 0) {
            if (ped.pos.y < -0.1) { /* rien */ }
            ped.pos.y = 0;
            ped.flyVel = null;
            if (this.fx) this.fx.blood(ped.pos, null, 8);
          }
          ped.deadAnim = Math.min(1, ped.deadAnim + dt * 3);
        } else {
          ped.deadAnim = Math.min(1, ped.deadAnim + dt * 2.2);
        }
        ped.deadT -= dt;
        if (ped.deadT <= 0) {
          this.torso.setMatrixAt(n, this.zero);
          this.head.setMatrixAt(n, this.zero);
          this.legs.setMatrixAt(idx++, this.zero);
          this.legs.setMatrixAt(idx++, this.zero);
          const respawn = setTimeout(() => this.respawn(ped), 50);
          continue;
        }
        this.poseDead(ped, root, local, n, idx);
        idx += 2;
        continue;
      }

      /* agression des membres de gang */
      if (ped.aggressive && !player.wasted && !player.busted && ped.atkT <= 0) {
        const dPl = ped.pos.distanceTo(player.pos);
        if (dPl < 42) {
          if (dPl > 1.7) {
            const chase = player.pos.clone().sub(ped.pos).setY(0).normalize();
            ped.pos.addScaledVector(chase, 5.6 * dt);
            ped.heading = Math.atan2(chase.x, chase.z);
            ped.phase += dt * 13;
            ped.state = 'attack';
          } else {
            player.damage(6 + Math.random() * 8, null);
            ped.atkT = 1.1;
            ped.phase += dt * 16;
          }
        } else if (ped.state === 'attack') ped.state = 'walk';
      }
      ped.atkT -= dt;

      /* vie quotidienne */
      if (ped.sunbathe && ped.flinchT <= 0) {
        ped.phase += dt * 0.8;
      } else if (ped.flinchT > 0) {
        ped.flinchT -= dt;
      } else if (ped.state === 'panic') {
        ped.stateT -= dt;
        const away = ped.pos.clone().sub(player.pos).setY(0);
        if (away.lengthSq() > 0.01) {
          away.normalize();
          ped.pos.addScaledVector(away, 5.5 * dt);
          ped.heading = Math.atan2(away.x, away.z);
        }
        ped.phase += dt * 15;
        if (ped.stateT <= 0) { ped.state = 'walk'; this.pickTarget(ped); }
      } else if (ped.state === 'talk' && ped.partner) {
        ped.stateT -= dt;
        const to = ped.partner.pos;
        ped.heading = Math.atan2(to.x - ped.pos.x, to.z - ped.pos.z);
        ped.phase += dt * 3;
        if (ped.stateT <= 0 || ped.partner.dead) { ped.state = 'walk'; ped.partner = null; this.pickTarget(ped); }
      } else if (ped.spouse && !player.wasted) {
        const to = player.pos.clone().sub(ped.pos).setY(0);
        const d = to.length();
        if (d > 2.6) {
          to.normalize();
          ped.pos.addScaledVector(to, Math.min(6.5, d * 1.4) * dt);
          ped.heading = Math.atan2(to.x, to.z);
          ped.phase += dt * 8;
        }
      } else {
        const moveSp = ped.jogger && ped.state === 'walk' ? 4 : 1.1 + (ped.speedRand || 0.9);
        const to = ped.target.clone().sub(ped.pos).setY(0);
        const dist = to.length();
        if (dist < 2) {
          if (Math.random() < 0.12) {
            ped.state = 'idle';
            ped.stateT = 2 + Math.random() * 4;
          } else this.pickTarget(ped);
        } else {
          to.normalize();
          ped.pos.addScaledVector(to, moveSp * dt);
          ped.heading = Math.atan2(to.x, to.z);
          ped.phase += dt * (ped.jogger ? 12 : 7);
        }
      }
      if (ped.state === 'idle') {
        ped.stateT -= dt;
        ped.phase += dt * 1.5;
        if (ped.stateT <= 0) { ped.state = 'walk'; this.pickTarget(ped); }
      }

      /* discussions spontanées */
      if (ped.state === 'walk' && Math.random() < 0.0015 && !ped.partner) {
        const other = this.list[(Math.random() * this.count) | 0];
        if (other !== ped && !other.dead && other.state === 'walk' && other.pos.distanceTo(ped.pos) < 3) {
          ped.state = other.state = 'talk';
          ped.partner = other; other.partner = ped;
          ped.stateT = other.stateT = 3 + Math.random() * 3;
        }
      }

      const bob = Math.abs(Math.sin(ped.phase)) * 0.05;
      const flinchBend = ped.flinchT > 0 ? -0.4 * Math.sin(ped.flinchT / 0.5 * Math.PI) : 0;
      const lying = ped.sunbathe ? -1.42 : 0;
      root.makeRotationX(flinchBend * 0.4 + lying);
      root.multiply(new THREE.Matrix4().makeRotationY(ped.heading));
      root.setPosition(ped.pos.x, ped.pos.y + bob + Math.max(0, -flinchBend) * 0.05 + (ped.sunbathe ? 0.35 : 0), ped.pos.z);

      sub.position.set(0, 0, 0); sub.rotation.set(0, 0, 0); sub.updateMatrix();
      local.multiplyMatrices(root, sub.matrix);
      this.torso.setMatrixAt(n, local);

      sub.position.set(0, 0.14, 0); sub.rotation.set(0, 0, 0); sub.updateMatrix();
      local.multiplyMatrices(root, sub.matrix);
      this.head.setMatrixAt(n, local);

      const legSwing = ped.state === 'talk' || ped.state === 'idle' || ped.sunbathe ? 0 : (ped.jogger ? 0.65 : 0.45);
      sub.position.set(-0.12, 0.78, 0);
      sub.rotation.x = Math.sin(ped.phase) * legSwing;
      sub.updateMatrix();
      local.multiplyMatrices(root, sub.matrix);
      this.legs.setMatrixAt(idx++, local);
      sub.position.set(0.12, 0.78, 0);
      sub.rotation.x = -Math.sin(ped.phase) * legSwing;
      sub.updateMatrix();
      local.multiplyMatrices(root, sub.matrix);
      this.legs.setMatrixAt(idx++, local);
    }
    this.torso.instanceMatrix.needsUpdate = true;
    this.head.instanceMatrix.needsUpdate = true;
    this.legs.instanceMatrix.needsUpdate = true;
  }

  poseDead(ped, root, local, n, idx) {
    const fall = Math.min(1, ped.deadAnim);
    root.makeRotationY(ped.heading);
    if (ped.flyVel) root.multiply(new THREE.Matrix4().makeRotationZ(0));
    root.multiply(new THREE.Matrix4().makeRotationX(fall * Math.PI / 2));
    root.setPosition(ped.pos.x, ped.pos.y + 0.42 - fall * 0.25, ped.pos.z);

    this.sub.position.set(0, 0, 0); this.sub.rotation.set(0, 0, 0); this.sub.updateMatrix();
    local.multiplyMatrices(root, this.sub.matrix);
    this.torso.setMatrixAt(n, local);

    this.sub.position.set(0, 0.14, 0); this.sub.updateMatrix();
    local.multiplyMatrices(root, this.sub.matrix);
    this.head.setMatrixAt(n, local);

    this.sub.position.set(-0.12, 0.78, 0); this.sub.rotation.x = 0.3; this.sub.updateMatrix();
    local.multiplyMatrices(root, this.sub.matrix);
    this.legs.setMatrixAt(idx++, local);
    this.sub.position.set(0.12, 0.78, 0); this.sub.updateMatrix();
    local.multiplyMatrices(root, this.sub.matrix);
    this.legs.setMatrixAt(idx++, local);
  }

  respawn(ped) {
    ped.dead = false; ped.hidden = false;
    ped.health = ped.aggressive ? 72 : 40;
    ped.flyVel = null;
    ped.deadAnim = 0;
    ped.state = ped.sunbathe ? 'sunbathe' : 'walk';
    ped.partner = null;
    ped.atkT = 0;
    ped.pos.copy(ped.sunbathe ? this.beachPos() : this.spawnPos());
    this.pickTarget(ped, true);
  }

  aliveNear(pos, r) {
    let n = 0;
    for (const ped of this.list) if (!ped.dead && ped.pos.distanceTo(pos) < r) n++;
    return n;
  }
}
