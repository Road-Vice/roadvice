import * as THREE from 'three';
import { Vehicle } from './vehicles.js';
import { randomRoadPoint, nearestRoadPoint } from './world.js';
import { buildHumanGroup } from './characters.js';

export const THRESHOLDS = [50, 150, 300, 450, 600];
const COPCARS_BY_STAR = [1, 2, 4, 5, 6];
const SOLDIERS_BY_STAR = [0, 0, 0, 2, 4];

class Shooter {
  constructor(scene, pos, kind) {
    const built = buildHumanGroup({
      shirt: kind === 'cop' ? 0x2a4b8f : 0x4a5d3a,
      hat: kind === 'cop' ? 0x1a2a4a : 0x2e3a22,
      baton: kind === 'cop'
    });
    this.mesh = built.group; this.legL = built.legL; this.legR = built.legR;
    this.armR = built.armR;
    scene.add(this.mesh);
    this.pos = pos.clone(); this.kind = kind;
    this.health = kind === 'soldier' ? 70 : 45;
    this.shootT = 0.6 + Math.random();
    this.phase = Math.random() * 10;
    this.beatT = 0;
    this.dead = false;
    this.mesh.position.copy(this.pos);
  }

  update(dt, player, ctx) {
    if (this.dead) return;
    const dx = player.pos.x - this.pos.x, dz = player.pos.z - this.pos.z;
    const dist = Math.hypot(dx, dz);
    const cuffed = player.cuffed;
    const stand = cuffed ? 1.8 : (this.kind === 'cop' ? 11 : 14);
    const speed = dist > stand ? (this.kind === 'cop' ? 5.2 : 6.2) : 0;
    if (dist > 0.1) {
      const ux = dx / dist, uz = dz / dist;
      this.pos.x += ux * speed * dt;
      this.pos.z += uz * speed * dt;
      this.mesh.rotation.y = Math.atan2(ux, uz);
    }
    this.phase += dt * 10;
    const swing = Math.sin(this.phase) * (speed > 0 ? 0.6 : 0.05);
    this.legL.rotation.x = swing;
    this.legR.rotation.x = -swing;
    this.beatT = Math.max(0, this.beatT - dt * 2);
    if (!cuffed) {
      this.armR.rotation.x = this.beatT > 0 ? -1.6 * Math.sin(this.beatT * Math.PI) : swing * 0.3;
    } else {
      this.armR.rotation.x = 0;
    }
    this.mesh.position.copy(this.pos);

    if (cuffed) return;
    if (dist < 2.6 && this.beatT <= 0 && this.kind === 'cop' && player.onFoot && !player.vehicle) {
      this.beatT = 1;
    }
    if (this.beatT > 0 && this.beatT < 0.55 && !this._hitThisBeat) {
      this._hitThisBeat = true;
      ctx.audio.punch();
      ctx.fx.blood(player.pos.clone().setY(1.35), null, 4);
      player.damage(13, ctx);
      player.beatCount = (player.beatCount || 0) + 1;
      if (player.beatCount >= 3) player.cuffed = true;
    }
    if (this.beatT <= 0) this._hitThisBeat = false;

    this.shootT -= dt;
    if (this.shootT <= 0 && dist < 38 && this.beatT <= 0) {
      this.shootT = this.kind === 'cop' ? 1.0 : 0.55;
      const from = this.pos.clone(); from.y = 1.4;
      const to = player.pos.clone(); to.y = player.onFoot ? 1.2 : 0.8;
      const acc = Math.max(0.08, 0.55 - dist / 60);
      ctx.fx.tracer(from, to, this.kind === 'cop' ? 0xffe080 : 0xff8080);
      ctx.audio.gunshot(0.5);
      if (Math.random() < acc / Math.max(1, (player.vehicle ? 2 : 1))) {
        if (player.vehicle) player.vehicle.applyDamage(7);
        else player.damage(this.kind === 'cop' ? 8 : 13, ctx);
      }
    }
  }

  kill(ctx) {
    if (this.dead) return;
    this.dead = true;
    this.mesh.rotation.x = Math.PI / 2.2;
    ctx.fx.blood(this.pos.clone().setY(1.2), null, 10);
  }
}

export class Police {
  constructor(scene, fx, audio) {
    this.scene = scene;
    this.fx = fx;
    this.audio = audio;
    this.points = 0;
    this.stars = 0;
    this.evadeT = 0;
    this.copCars = [];
    this.cops = [];
    this.soldiers = [];
    this.heli = null;
    this.spawnT = 0;
    this.arrestT = 0;
    this.bustedT = 0;
    this.sirenT = 0;
  }

  addCrime(pts) {
    this.points = Math.min(700, this.points + pts);
    this.evadeT = 0;
  }

  clear() {
    for (const c of this.copCars) c.dispose(this.scene);
    for (const c of this.cops) this.scene.remove(c.mesh);
    for (const s of this.soldiers) this.scene.remove(s.mesh);
    this.copCars = []; this.cops = []; this.soldiers = [];
    if (this.heli) { this.scene.remove(this.heli.mesh); this.heli = null; }
    this.points = 0; this.stars = 0; this.evadeT = 0;
    this.arrestT = 0; this.bustedT = 0;
  }

  spawnCop(playerPos) {
    const spawnPos = this.spawnPointNear(playerPos);
    const v = new Vehicle(this.scene, 'police', spawnPos, Math.random() * Math.PI * 2);
    v.maxFwd = 38;
    this.copCars.push(v);
  }

  spawnPointNear(playerPos) {
    const ang = Math.random() * Math.PI * 2;
    const d = 90 + Math.random() * 60;
    return nearestRoadPoint(
      Math.max(-600, Math.min(600, playerPos.x + Math.cos(ang) * d)),
      Math.max(-600, Math.min(600, playerPos.z + Math.sin(ang) * d))
    );
  }

  update(dt, ctx) {
    const player = ctx.player;
    this.stars = THRESHOLDS.filter(t => this.points >= t).length;

    if (this.stars === 0) {
      if (this.heli) { this.scene.remove(this.heli.mesh); this.heli = null; }
      this.updateUnitsExit(dt);
      this.audio.siren(false);
      this.audio.heli(false);
      this.arrestT = 0; this.bustedT = 0;
      return;
    }

    let anyNear = false;

    for (const c of this.copCars) {
      if (c.wrecked) continue;
      const lead = player.vehicle && player.vehicle.speed > 10
        ? player.vehicle.forward().multiplyScalar(player.vehicle.speed * 0.6) : new THREE.Vector3();
      const dist = c.kinematic(dt, player.pos.clone().add(lead), 26 + this.stars * 2, ctx.worldColliders);
      if (dist < 60) anyNear = true;

      if (dist < 60 && this.stars >= 3 && !player.cuffed) {
        c.shootT = (c.shootT === undefined ? Math.random() : c.shootT) - dt;
        if (c.shootT <= 0) {
          c.shootT = 1.4;
          const from = c.pos.clone(); from.y = 1.3;
          const to = player.pos.clone(); to.y = 1;
          this.fx.tracer(from, to, 0xffe080);
          this.audio.gunshot(0.4);
          if (Math.random() < 0.2) {
            if (player.vehicle) player.vehicle.applyDamage(5);
            else player.damage(6, ctx);
          }
        }
      }
      if (player.vehicle && dist < 5.5 && c.speed > 6) {
        player.vehicle.applyDamage(9);
        ctx.fx.spark(player.pos.clone().setY(0.8));
        player.shake = 0.5;
      }
      const bar = c.lightbar;
      if (bar) {
        this.sirenT += dt;
        const on = Math.sin(this.sirenT * 14) > 0;
        bar.r.opacity = on ? 1 : 0.12;
        bar.b.opacity = on ? 0.12 : 1;
      }
    }
    this.copCars = this.copCars.filter(c => {
      if (c.wrecked && c.wreckT === undefined) { c.wreckT = 14; return true; }
      if (c.wrecked) {
        c.wreckT -= dt;
        if (c.wreckT <= 0) { c.dispose(this.scene); return false; }
      }
      return true;
    });

    /* policiers à pied */
    const nearCount = this.copCars.filter(c => !c.wrecked && c.pos.distanceTo(player.pos) < 14).length;
    if (player.onFoot && nearCount > 0 && this.cops.length < 6) {
      for (const c of this.copCars) {
        if (c.wrecked || c.copsOut) continue;
        if (c.pos.distanceTo(player.pos) < 14) {
          c.copsOut = true;
          for (let i = 0; i < 2 && this.cops.length < 6; i++) {
            const p = c.pos.clone().add(new THREE.Vector3((i - 0.5) * 2, 0, 1.5));
            this.cops.push(new Shooter(this.scene, p, 'cop'));
          }
        }
      }
    }
    for (const cop of this.cops) {
      cop.update(dt, player, ctx);
      if (cop.pos.distanceTo(player.pos) < 55) anyNear = true;
    }
    for (const cop of this.cops) if (cop.dead) cop.deadT = (cop.deadT === undefined ? 8 : cop.deadT) - dt;
    this.cops = this.cops.filter(c => {
      if (c.dead && c.deadT <= 0) { this.scene.remove(c.mesh); return false; }
      return true;
    });

    /* armée */
    this.spawnT -= dt;
    if (this.spawnT <= 0) {
      this.spawnT = 3;
      const wantCars = COPCARS_BY_STAR[this.stars - 1] + (this.stars >= 4 ? 1 : 0);
      const wantSoldiers = SOLDIERS_BY_STAR[this.stars - 1];
      if (this.copCars.filter(c => !c.wrecked).length < wantCars) this.spawnCop(player.pos);
      if (this.soldiers.filter(s => !s.dead).length < wantSoldiers) {
        const pos = this.spawnPointNear(player.pos);
        this.soldiers.push(new Shooter(this.scene, pos, 'soldier'));
      }
    }

    /* --- arrestation --- */
    if (player.onFoot && !player.vehicle) {
      let touching = false;
      for (const cop of this.cops) {
        if (!cop.dead && cop.pos.distanceTo(player.pos) < 2.6) { touching = true; break; }
      }
      if (player.cuffed) {
        this.arrestT = 0;
        this.bustedT += dt;
        if (this.bustedT > 2.2) {
          player.arrestMode = 'pacifique';
          player.busted = true;
          this.bustedT = 0;
        }
      } else if (player.surrender && touching) {
        player.cuffed = true;
      } else {
        this.arrestT = touching ? this.arrestT + dt : 0;
        const violent = (performance.now() / 1000 - player.lastViolence) < 9 || this.stars >= 4;
        if (this.arrestT > 1.3) {
          if (violent) {
            player.arrestMode = 'violente';
            this.arrestT = 0.7;
          } else {
            player.cuffed = true;
          }
        }
      }
    }
    if (!player.onFoot) { this.bustedT = Math.max(0, this.bustedT - dt); }

    /* hélico 5★ */
    if (this.stars >= 5 && !this.heli) this.spawnHeli();
    if (this.heli) {
      this.updateHeli(dt, ctx);
      if (this.heli.pos.distanceTo(player.pos) < 120) anyNear = true;
    }

    this.audio.siren(true);
    this.audio.heli(!!this.heli);

    if (!anyNear) {
      this.evadeT += dt;
      if (this.evadeT > 6) this.points = Math.max(0, this.points - 34 * dt);
    } else {
      this.evadeT = 0;
    }
  }

  spawnHeli() {
    const g = new THREE.Group();
    const body = new THREE.Mesh(new THREE.BoxGeometry(2.4, 1.8, 5.5),
      new THREE.MeshStandardMaterial({ color: 0x2a3550, metalness: 0.5, roughness: 0.4 }));
    g.add(body);
    const tail = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.6, 4), body.material);
    tail.position.set(0, 0.4, -4.2); g.add(tail);
    const rotor = new THREE.Mesh(new THREE.BoxGeometry(11, 0.06, 0.5),
      new THREE.MeshStandardMaterial({ color: 0x111111 }));
    rotor.position.y = 1.4; g.add(rotor);
    const tailRotor = new THREE.Mesh(new THREE.BoxGeometry(0.06, 1.8, 0.3),
      new THREE.MeshStandardMaterial({ color: 0x111111 }));
    tailRotor.position.set(0.35, 0.6, -4.2); g.add(tailRotor);
    const spot = new THREE.SpotLight(0xfff4d0, 0, 90, 0.34, 0.5, 1);
    const spotTarget = new THREE.Object3D();
    g.add(spotTarget);
    spot.target = spotTarget;
    spot.position.set(0, -0.9, 1);
    g.add(spot);
    this.scene.add(g);
    const pos = new THREE.Vector3(0, 30, 0);
    this.heli = {
      mesh: g, rotor, tailRotor, spot, spotTarget, pos,
      health: 220, shootT: 2, angle: 0
    };
    g.position.copy(pos);
  }

  updateHeli(dt, ctx) {
    const h = this.heli, player = ctx.player;
    h.angle += dt * 0.25;
    const target = player.pos.clone().add(new THREE.Vector3(Math.cos(h.angle) * 14, 26, Math.sin(h.angle) * 14));
    h.pos.lerp(target, Math.min(1, dt * 0.8));
    h.mesh.position.copy(h.pos);
    h.mesh.rotation.y += dt * 2.4;
    h.rotor.rotation.y += dt * 30;
    h.tailRotor.rotation.x += dt * 40;
    h.mesh.rotation.x = 0.14;
    h.spot.intensity = ctx.night > 0.4 ? 900 : 0;
    h.spotTarget.position.copy(h.mesh.worldToLocal(player.pos.clone()));

    h.shootT -= dt;
    if (h.shootT <= 0 && h.pos.distanceTo(player.pos) < 45 && !player.cuffed) {
      h.shootT = 1.3;
      const from = h.pos.clone(); from.y -= 1;
      const to = player.pos.clone(); to.y = 1;
      this.fx.tracer(from, to, 0xffa040);
      this.audio.gunshot(0.7);
      if (Math.random() < 0.4) {
        if (player.vehicle) player.vehicle.applyDamage(8);
        else player.damage(10, ctx);
      }
    }
  }

  updateUnitsExit(dt) {
    for (const c of this.copCars) {
      if (c.wrecked) continue;
      c.kinematic(dt, randomRoadPoint(), 4, ctxNullColliders());
      if (c.lightbar) { c.lightbar.r.opacity = 0; c.lightbar.b.opacity = 0; }
    }
  }
}

function ctxNullColliders() { return null; }
