import * as THREE from 'three';
import { nearestRoadPoint, LIM } from './world.js';
import { buildPlayerMesh } from './characters.js';

export const WEAPONS = [
  { name: 'Poings', icon: '👊', dmg: 26, rate: 2.2, range: 2.3, auto: false, ammo: Infinity, color: 0xffffff, melee: true },
  { name: 'Couteau', icon: '🔪', dmg: 55, rate: 2, range: 2.1, auto: false, ammo: Infinity, color: 0xffffff, melee: true },
  { name: 'Batte', icon: '🏏', dmg: 44, rate: 1.6, range: 2.7, auto: false, ammo: Infinity, color: 0xffffff, melee: true },
  { name: 'Pistolet', icon: '🔫', dmg: 26, rate: 3.2, range: 70, auto: false, ammo: 72, color: 0xffe080 },
  { name: 'Revolver', icon: '🔫', dmg: 48, rate: 1.4, range: 55, auto: false, ammo: 48, color: 0xffd0d0 },
  { name: 'Mitraillette', icon: '🔫', dmg: 13, rate: 11, range: 58, auto: true, ammo: 240, color: 0xffa040 },
  { name: 'Fusil d’assaut', icon: '🎖️', dmg: 36, rate: 6.5, range: 100, auto: true, ammo: 180, color: 0xffb060 },
  { name: 'M4 tactique', icon: '🎖️', dmg: 30, rate: 7.6, range: 115, auto: true, ammo: 270, color: 0xffb060 },
  { name: 'Fusil à pompe', icon: '💥', dmg: 13, rate: 1.1, range: 26, auto: false, ammo: 48, color: 0xffa040, pellets: 7, spread: 0.07 },
  { name: 'Sniper', icon: '🎯', dmg: 95, rate: 0.8, range: 240, auto: false, ammo: 24, color: 0xffffff },
  { name: 'Minigun', icon: '🌀', dmg: 15, rate: 16, range: 70, auto: true, ammo: 600, color: 0xffa040 },
  { name: 'Lance-roquettes', icon: '🚀', dmg: 120, rate: 0.6, range: 140, auto: false, ammo: 6, color: 0xffffff, rocket: true },
  { name: 'Lance-grenades', icon: '💣', dmg: 150, rate: 0.75, range: 90, auto: false, ammo: 10, color: 0xffffff, rocket: true }
];

export class Player {
  constructor(scene) {
    this.scene = scene;
    this.onFoot = true;
    this.pos = new THREE.Vector3(10, 0, 4);
    this.heading = 0;
    this.health = 100;
    this.hunger = 100;
    this.thirst = 100;
    this.energy = 100;
    this.money = 500;
    this.vehicle = null;
    this.parked = [];
    this.shake = 0;
    this.fireT = 0;
    this.punchT = 0;
    this.busted = false;
    this.wasted = false;
    this.cuffed = false;
    this.lastViolence = -99;
    this.deadT = 0;
    this.walkPhase = 0;
    this.moveAmt = 0;
    this.home = null;

    const rig = buildPlayerMesh();
    this.mesh = rig.group;
    this.rig = rig;
    this.mesh.visible = true;
    scene.add(this.mesh);

    this.weapons = WEAPONS.map(w => ({ ammo: w.ammo === Infinity ? Infinity : 0 }));
    this.weaponIdx = 0;
    this.giveWeapon(2);
  }

  get weapon() { return WEAPONS[this.weaponIdx]; }
  get weaponAmmo() { return this.weapons[this.weaponIdx].ammo; }

  giveWeapon(idx, ammoBonus = 0) {
    const w = WEAPONS[idx];
    this.weapons[idx].ammo = (w.ammo === Infinity ? Infinity : w.ammo + ammoBonus);
    this.weaponIdx = idx;
  }

  addAmmo(amount = 60) {
    const slot = this.weapons[this.weaponIdx];
    if (slot.ammo !== Infinity) slot.ammo += amount;
  }

  registerViolence() { this.lastViolence = performance.now() / 1000; }

  damage(d, ctx, silent = false) {
    if (this.wasted || this.busted) return;
    this.health -= d;
    if (!silent) this.shake = Math.min(1, this.shake + 0.4);
    if (ctx && ctx.hud) ctx.hud.bloodFlash(Math.min(1, d / 30));
    if (this.health <= 0) {
      this.health = 0;
      this.wasted = true;
      this.deadT = 0;
    }
  }

  update(dt, ctx) {
    if (this.wasted || this.busted) {
      this.deadT += dt;
      this.rig.animate(0, 0, false, 0, false);
      return;
    }

    /* --- besoins vitaux --- */
    this.hunger = Math.max(0, this.hunger - dt * 0.045);
    this.thirst = Math.max(0, this.thirst - dt * (ctx.input.run ? 0.09 : 0.06));
    this.energy = Math.max(0, this.energy - dt * (ctx.input.run && !this.vehicle ? 0.11 : 0.06));
    if (this.hunger <= 0 || this.thirst <= 0 || this.energy <= 0) this.damage(dt * 1.6, ctx, true);
    else if (this.hunger > 55 && this.thirst > 55 && this.energy > 40 && this.health < 100)
      this.health = Math.min(100, this.health + dt * 1.1);

    if (this.vehicle) {
      this.vehicle.drive(dt, ctx.input, ctx.worldColliders);
      this.pos.copy(this.vehicle.pos);
      this.heading = this.vehicle.heading;
      this.rig.animate(this.walkPhase, 0, false, 0, false);
      return;
    }

    const input = ctx.input;
    const canRun = input.run && this.energy > 12;
    const speedCap = this.cuffed ? 1.4 : (canRun ? 7.6 : 4.2);
    const camYaw = ctx.camYaw;
    const up = new THREE.Vector3(Math.sin(camYaw), 0, Math.cos(camYaw));
    const rt = new THREE.Vector3(Math.cos(camYaw), 0, -Math.sin(camYaw));
    const move = new THREE.Vector3();
    if (input.forward) move.add(up);
    if (input.back) move.sub(up);
    if (input.right) move.add(rt);
    if (input.left) move.sub(rt);
    let moving = false;
    if (move.lengthSq() > 0) {
      moving = true;
      move.normalize();
      this.pos.addScaledVector(move, speedCap * dt);
      const target = Math.atan2(move.x, move.z);
      let diff = target - this.heading;
      while (diff > Math.PI) diff -= 2 * Math.PI;
      while (diff < -Math.PI) diff += 2 * Math.PI;
      this.heading += diff * Math.min(1, dt * 10);
      this.walkPhase += dt * (canRun ? 12 : 8);
    }
    this.moveAmt += ((moving ? 1 : 0) - this.moveAmt) * Math.min(1, dt * 8);

    for (const c of ctx.worldColliders.near(this.pos.x, this.pos.z)) {
      if (this.pos.x > c.minX - 0.5 && this.pos.x < c.maxX + 0.5 &&
          this.pos.z > c.minZ - 0.5 && this.pos.z < c.maxZ + 0.5 && this.pos.y < c.h) {
        const push = [
          [c.maxX + 0.5 - this.pos.x, 1, 0], [this.pos.x - (c.minX - 0.5), -1, 0],
          [c.maxZ + 0.5 - this.pos.z, 0, 1], [this.pos.z - (c.minZ - 0.5), 0, -1]
        ].sort((a, b) => a[0] - b[0])[0];
        this.pos.x += push[1] * push[0]; this.pos.z += push[2] * push[0];
      }
    }
    this.pos.x = Math.max(-LIM, Math.min(LIM, this.pos.x));
    this.pos.z = Math.max(-LIM, Math.min(LIM, this.pos.z));

    this.mesh.visible = true;
    this.mesh.position.copy(this.pos);
    this.mesh.rotation.y = this.heading;

    this.punchT = Math.max(0, this.punchT - dt);
    this.rig.animate(this.walkPhase, this.moveAmt, input.run, this.cuffed ? 0 : this.punchT, this.cuffed);

    this.fireT -= dt;
    if (ctx.input.fire && this.fireT <= 0 && !this.cuffed) {
      this.shoot(ctx);
      this.fireT = 1 / this.weapon.rate;
      if (!this.weapon.auto) ctx.input.fire = false;
    }
  }

  shoot(ctx) {
    const cam = ctx.camera;
    const dir = new THREE.Vector3();
    cam.getWorldDirection(dir);
    const origin = this.pos.clone().add(new THREE.Vector3(0, 1.5, 0));

    if (this.weapon.melee) {
      this.melee(ctx, dir, this.weaponIdx === 1);
      this.punchT = 0.32;
      return;
    }
    const slot = this.weapons[this.weaponIdx];
    if (slot.ammo <= 0) { ctx.hud.notify('Plus de munitions !'); ctx.input.fire = false; return; }
    if (slot.ammo !== Infinity) slot.ammo--;

    const from = origin.clone().addScaledVector(dir, 0.6); from.y -= 0.3;

    if (this.weapon.rocket) {
      ctx.spawnRocket(origin.clone().addScaledVector(dir, 1).setY(1.4), dir);
      return;
    }

    const pellets = this.weapon.pellets || 1;
    const spread = this.weapon.spread || 0.001;
    for (let p = 0; p < pellets; p++) {
      const d = dir.clone();
      if (pellets > 1) {
        d.x += (Math.random() - 0.5) * spread * 2;
        d.z += (Math.random() - 0.5) * spread * 2;
        d.y += (Math.random() - 0.5) * spread;
        d.normalize();
      }
      let hitDist = ctx.rayBlocked(origin, d, this.weapon.range);
      const hit = evalTargets(ctx, origin, d, hitDist, this.weapon);
      if (hit) hitDist = hit.dist;
      const to = origin.clone().addScaledVector(d, hitDist);
      ctx.fx.tracer(p === 0 ? from : origin, to, this.weapon.color);
      if (hit) this.applyHit(hit, ctx);
    }
    ctx.audio.gunshot(this.weaponIdx >= 4 ? 1.3 : 1);
    ctx.noiseEvents.push({ pos: this.pos.clone(), t: 4 });
  }

  applyHit(hit, ctx) {
    if (hit.kind === 'ped') {
      const impulse = hit.dir ? hit.dir.clone().setY(0).normalize().multiplyScalar(2) : null;
      if (hit.dmg >= hit.pedHealth) {
        ctx.peds.kill(hit.obj, true);
        ctx.fx.blood(hit.point, hit.dir, 14);
        ctx.police.addCrime(100);
      } else {
        ctx.peds.hitPed(hit.obj, hit.dmg, impulse, true);
        ctx.fx.blood(hit.point, hit.dir, 8);
        ctx.audio.punch();
      }
      this.registerViolence();
    } else if (hit.kind === 'cop' || hit.kind === 'soldier') {
      hit.obj.health -= hit.dmg;
      ctx.fx.blood(hit.point, hit.dir, 8);
      ctx.audio.punch();
      if (hit.obj.health <= 0) {
        hit.obj.kill(ctx);
        ctx.police.addCrime(hit.kind === 'cop' ? 150 : 200);
      }
      this.registerViolence();
      ctx.enemyAlert = true;
    } else if (hit.kind === 'heli') {
      ctx.police.heli.health -= hit.dmg;
      ctx.fx.spark(hit.point);
      if (ctx.police.heli.health <= 0) {
        ctx.fx.explosion(ctx.police.heli.pos);
        ctx.audio.explosion();
        ctx.scene.remove(ctx.police.heli.mesh);
        ctx.police.heli = null;
        ctx.police.addCrime(250);
        ctx.hud.notify('Hélicoptère détruit ! +2★');
      }
      this.registerViolence();
    } else if (hit.kind === 'car') {
      const died = hit.obj.applyDamage(hit.dmg);
      ctx.fx.spark(hit.point);
      if (died) {
        hit.obj.wreck(ctx.fx, ctx.audio);
        ctx.explosionArea(hit.obj.pos, ctx, 8);
        if (hit.obj.type === 'police') ctx.police.addCrime(120);
        if (hit.obj.type === 'army') ctx.police.addCrime(200);
        if (ctx.traffic.vehicles.includes(hit.obj)) ctx.traffic.remove(hit.obj);
        this.registerViolence();
      }
    }
  }

  melee(ctx, dir, knife) {
    const range = this.weapon.range;
    let best = null, bd = range;
    for (const ped of ctx.peds.list) {
      if (ped.dead) continue;
      const d = ped.pos.distanceTo(this.pos);
      if (d < bd) {
        const to = ped.pos.clone().sub(this.pos).setY(0).normalize();
        if (to.dot(dir.clone().setY(0).normalize()) > 0.25) { bd = d; best = ped; }
      }
    }
    if (best) {
      const point = best.pos.clone().setY(1.2);
      const dmg = this.weapon.dmg;
      if (best.health - dmg <= 0) {
        ctx.peds.kill(best, true);
        ctx.fx.blood(point, dir, 12);
        ctx.police.addCrime(knife ? 110 : 90);
      } else {
        ctx.peds.hitPed(best, dmg, dir.clone().multiplyScalar(1.4), true);
        ctx.fx.blood(point, dir, knife ? 10 : 3);
        ctx.audio.punch();
      }
      this.registerViolence();
    }
    for (const cop of [...ctx.police.cops, ...ctx.police.soldiers]) {
      if (cop.dead) continue;
      if (cop.pos.distanceTo(this.pos) < range) {
        cop.health -= this.weapon.dmg;
        ctx.fx.blood(cop.pos.clone().setY(1.3), dir, 4);
        ctx.audio.punch();
        if (cop.health <= 0) {
          cop.kill(ctx);
          ctx.police.addCrime(160);
        }
        this.registerViolence();
        ctx.enemyAlert = true;
      }
    }
    if (!best) ctx.audio.woosh();
  }

  enterNearestVehicle(ctx) {
    const near = (list, maxD = 4) => {
      let best = null, bd = maxD;
      for (const v of list) {
        if (v.wrecked) continue;
        const d = v.pos.distanceTo(this.pos);
        if (d < bd) { bd = d; best = v; }
      }
      return best;
    };
    let v = near(ctx.traffic.vehicles) || near(this.parked);
    let crime = 0;
    if (!v) { v = near(ctx.police.copCars); if (v) crime = 120; }
    if (!v) return false;

    if (ctx.traffic.vehicles.includes(v)) { ctx.traffic.remove(v); crime = 40; }
    const ci = ctx.police.copCars.indexOf(v);
    if (ci >= 0) ctx.police.copCars.splice(ci, 1);
    const pi = this.parked.indexOf(v);
    if (pi >= 0) this.parked.splice(pi, 1);
    v.ai = false;
    v.stopped = 0;
    this.vehicle = v;
    this.onFoot = false;
    this.mesh.visible = false;
    if (crime) ctx.police.addCrime(crime);
    return true;
  }

  exitVehicle(ctx) {
    const v = this.vehicle;
    if (!v) return;
    if (v.speed > 14) return;
    const side = v.right().multiplyScalar(-2);
    this.pos.copy(v.pos).add(side);
    this.pos.y = 0;
    this.onFoot = true;
    this.parked.push(v);
    this.vehicle = null;
    this.mesh.visible = true;
  }

  respawn(x, z, fee, ctx, force = false) {
    const homeSpot = (!force && this.home) ? nearestRoadPoint(this.home.x, this.home.z) : nearestRoadPoint(x, z);
    if (this.vehicle) {
      this.vehicle.dispose(this.scene);
      this.vehicle = null;
    }
    this.pos.copy(homeSpot);
    this.health = 100;
    this.hunger = Math.max(this.hunger, 45);
    this.thirst = Math.max(this.thirst, 45);
    this.energy = Math.max(this.energy, 70);
    this.onFoot = true;
    this.mesh.visible = true;
    this.wasted = false;
    this.busted = false;
    this.cuffed = false;
    this.money = Math.max(0, this.money - fee);
    ctx.police.clear();
    for (const w of this.weapons) if (w.ammo !== Infinity) w.ammo = Math.floor(w.ammo / 2);
  }
}

/* évalue les cibles touchables le long du rayon */
function evalTargets(ctx, origin, dir, maxDist, weapon) {
  const t = new THREE.Vector3();
  let best = null;
  const test = (pos, radius, obj, kindName, extra = {}) => {
    t.copy(pos).sub(origin);
    const along = t.dot(dir);
    if (along < 0 || along > maxDist) return;
    const perp = Math.sqrt(Math.max(0, t.lengthSq() - along * along));
    if (perp <= radius) {
      if (!best || along < best.dist) {
        best = {
          dist: along,
          point: origin.clone().addScaledVector(dir, along),
          obj, kind: kindName,
          dir: dir.clone(), dmg: weapon.dmg, ...extra
        };
      }
    }
  };
  for (const ped of ctx.peds.list) if (!ped.dead) test(ped.pos.clone().setY(1.15), 0.55, ped, 'ped', { pedHealth: ped.health });
  for (const cop of ctx.police.cops) if (!cop.dead) test(cop.pos.clone().setY(1.25), 0.55, cop, 'cop');
  for (const s of ctx.police.soldiers) if (!s.dead) test(s.pos.clone().setY(1.25), 0.55, s, 'soldier');
  if (ctx.police.heli) test(ctx.police.heli.pos, 3.4, null, 'heli');
  for (const v of ctx.traffic.vehicles) if (!v.wrecked) test(v.pos.clone().setY(0.7), 2.3, v, 'car');
  for (const v of ctx.police.copCars) if (!v.wrecked) test(v.pos.clone().setY(0.7), 2.3, v, 'car');
  if (!best) return null;
  if (ctx.rayBlocked) {
    const bd = ctx.rayBlocked(origin, dir, best.dist);
    if (bd < best.dist - 0.5) return null;
  }
  return best;
}
