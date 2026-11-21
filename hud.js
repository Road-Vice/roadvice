import { WORLD, HALF } from './world.js';
import { GANG_ZONE, BEACH_X } from './peds.js';

export class HUD {
  constructor() {
    this.el = {
      money: document.getElementById('money'),
      mission: document.getElementById('mission'),
      clock: document.getElementById('clock'),
      speed: document.getElementById('speed'),
      speedo: document.getElementById('speedo'),
      minimap: document.getElementById('minimap'),
      notif: document.getElementById('notif'),
      hud: document.getElementById('hud'),
      stars: document.getElementById('stars'),
      health: document.getElementById('health'),
      hunger: document.getElementById('hunger'),
      thirst: document.getElementById('thirst'),
      weapon: document.getElementById('weapon'),
      energy: document.getElementById('energy'),
      wicon: document.getElementById('wicon'),
      ring: document.getElementById('ring'),
      prompt: document.getElementById('prompt'),
      cross: document.getElementById('cross'),
      bloodfx: document.getElementById('bloodfx'),
      bigmsg: document.getElementById('bigmsg')
    };
    this.mctx = this.el.minimap.getContext('2d');
    this.notifTimer = 0;
    this.bloodOpacity = 0;
    this.pulseT = 0;
  }

  show() { this.el.hud.classList.remove('hidden'); }

  notify(text, time = 2.6) {
    this.el.notif.textContent = text;
    this.el.notif.style.opacity = 1;
    this.notifTimer = time;
  }

  prompt(text) {
    const p = this.el.prompt;
    if (!text) { p.classList.add('hidden'); return; }
    p.textContent = text;
    p.classList.remove('hidden');
  }

  bloodFlash(k = 0.6) {
    this.bloodOpacity = Math.min(0.9, Math.max(this.bloodOpacity, k));
    this.el.bloodfx.style.opacity = this.bloodOpacity;
  }

  setMission(text) { this.el.mission.textContent = text; }

  setWanted(stars, evading) {
    let html = '';
    for (let i = 0; i < 5; i++) html += `<span class="${i < stars ? 'on' : 'off'}">★</span>`;
    this.el.stars.innerHTML = html;
    this.el.stars.classList.toggle('evading', evading && stars > 0);
  }

  setWeapon(w, ammo) {
    const ammoTxt = ammo === Infinity ? '∞' : ammo;
    this.el.weapon.textContent = `${w.icon} ${w.name} — ${ammoTxt}`;
  }

  big(type, sub) {
    const el = this.el.bigmsg;
    if (!type) { el.classList.add('hidden'); return; }
    el.classList.remove('hidden');
    el.querySelector('h2').textContent = type;
    el.querySelector('p').textContent = sub || '';
  }

  update(dt, s) {
    const { speed, money, dayT, mapCanvas, player, trafficCars, cops, copsFoot, soldiers,
      checkpoint, waypoint, stars, evading, onFoot, weaponInfo, hunger, thirst } = s;

    this.el.speed.textContent = Math.round(speed * 3.6);
    this.el.speedo.style.opacity = onFoot ? 0.25 : 1;
    this.el.money.textContent = '$' + money;
    const hours = (dayT * 24 + 6) % 24;
    this.el.clock.textContent = String(Math.floor(hours)).padStart(2, '0') + ':' +
      String(Math.floor((hours % 1) * 60)).padStart(2, '0');
    this.el.health.style.width = Math.max(0, player.health) + '%';
    if (this.el.hunger) this.el.hunger.style.width = Math.max(0, hunger ?? 100) + '%';
    if (this.el.thirst) this.el.thirst.style.width = Math.max(0, thirst ?? 100) + '%';
    if (this.el.energy) this.el.energy.style.width = Math.max(0, s.energy ?? 100) + '%';
    if (this.el.wicon) this.el.wicon.textContent = s.weather ? s.weather.icon + ' ' + s.weather.name : '';
    if (this.el.ring) this.el.ring.classList.toggle('hidden', !s.spouse);

    if (player.health < 35) {
      this.pulseT += dt * 3;
      this.bloodFlash(0.25 + Math.sin(this.pulseT) * 0.12 + (35 - player.health) / 140);
    }
    if (this.bloodOpacity > 0) {
      this.bloodOpacity = Math.max(0, this.bloodOpacity - dt * 0.25);
      this.el.bloodfx.style.opacity = this.bloodOpacity;
    }

    if (weaponInfo) this.setWeapon(weaponInfo.w, weaponInfo.ammo);
    this.el.cross.classList.toggle('hidden', !onFoot || !s.aiming);

    if (this.notifTimer > 0) {
      this.notifTimer -= dt;
      if (this.notifTimer <= 0) this.el.notif.style.opacity = 0;
    }

    this.setWanted(stars, evading);

    const size = 230, S = 384;
    const ctx = this.mctx;
    ctx.clearRect(0, 0, size, size);
    ctx.drawImage(mapCanvas, 0, 0, S, S, 0, 0, size, size);
    const toMap = (x, z) => [((x + HALF) / WORLD) * size, ((z + HALF) / WORLD) * size];
    ctx.fillStyle = 'rgba(150,70,220,0.33)';
    ctx.fillRect(
      ((GANG_ZONE.x0 + HALF) / WORLD) * size, ((GANG_ZONE.z0 + HALF) / WORLD) * size,
      ((GANG_ZONE.x1 - GANG_ZONE.x0) / WORLD) * size, ((GANG_ZONE.z1 - GANG_ZONE.z0) / WORLD) * size);
    ctx.fillStyle = 'rgba(240,220,140,0.4)';
    ctx.fillRect(((BEACH_X + HALF) / WORLD) * size, 0, size, size);

    if (s.properties) {
      for (const pr of s.properties) {
        const [x, y] = toMap(pr.x, pr.z);
        ctx.fillStyle = pr.owned ? '#35e06a' : '#f0c035';
        ctx.fillRect(x - 2, y - 2, 4, 4);
      }
    }
    if (waypoint) {
      const [wx, wy] = toMap(waypoint.x, waypoint.z);
      ctx.fillStyle = '#35f0e0';
      ctx.beginPath(); ctx.arc(wx, wy, 5, 0, 7); ctx.fill();
    }
    if (checkpoint) {
      const [cx, cy] = toMap(checkpoint.x, checkpoint.z);
      ctx.fillStyle = '#ff2d95';
      ctx.beginPath(); ctx.arc(cx, cy, 4 + Math.sin(performance.now() / 200) * 1.5, 0, 7); ctx.fill();
    }
    ctx.fillStyle = '#55aaffcc';
    for (const c of cops) {
      const [x, y] = toMap(c.pos.x, c.pos.z);
      ctx.beginPath(); ctx.arc(x, y, 3, 0, 7); ctx.fill();
    }
    ctx.fillStyle = '#ff5555cc';
    for (const c of copsFoot.concat(soldiers)) {
      const [x, y] = toMap(c.pos.x, c.pos.z);
      ctx.fillRect(x - 1.5, y - 1.5, 3, 3);
    }
    ctx.fillStyle = '#ffffffaa';
    for (const car of trafficCars) {
      const [x, y] = toMap(car.pos.x, car.pos.z);
      ctx.fillRect(x - 1, y - 1, 2, 2);
    }
    const [px, py] = toMap(player.pos.x, player.pos.z);
    ctx.save();
    ctx.translate(px, py);
    const heading = onFoot ? player.heading : player.vehicle.heading;
    ctx.rotate(Math.PI - heading);
    ctx.fillStyle = '#35f0e0';
    ctx.strokeStyle = '#000';
    ctx.beginPath();
    ctx.moveTo(0, -7); ctx.lineTo(5, 6); ctx.lineTo(0, 3); ctx.lineTo(-5, 6);
    ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.restore();
  }
}
