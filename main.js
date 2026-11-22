import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { buildWorld, randomRoadPoint, nearestRoadPoint, LIM, makeRayTester, rc, HALF } from './world.js';
import { Player, WEAPONS } from './player.js';
import { Vehicle, carType, CATALOG } from './vehicles.js';
import { Traffic } from './traffic.js';
import { Peds } from './peds.js';
import { Police } from './police.js';
import { FX } from './fx.js';
import { HUD } from './hud.js';
import { Phone } from './phone.js';
import { GameAudio } from './audio.js';
import { Weather } from './weather.js';
import { Animals } from './animals.js';

const isTouch = matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window;
const smallPhone = isTouch && Math.min(screen.width || 9999, screen.height || 9999) < 480;
if (isTouch) document.getElementById('thint').textContent =
  'Joystick gauche bouger · glisse à droite pour viser · boutons à droite';

const app = document.getElementById('game');
const renderer = new THREE.WebGLRenderer({ antialias: !isTouch, powerPreference: 'high-performance' });
renderer.setSize(window.innerWidth, window.innerHeight);
const resCap = Math.min(window.devicePixelRatio || 1, isTouch ? 1.3 : 1.6);
renderer.setPixelRatio(resCap);
renderer.shadowMap.enabled = !isTouch;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
app.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.fog = new THREE.FogExp2(0xbcd9ec, smallPhone ? 0.0022 : (isTouch ? 0.0018 : 0.0013));
const camera = new THREE.PerspectiveCamera(66, window.innerWidth / window.innerHeight, 0.1, isTouch ? 1500 : 3500);

try {
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
} catch (e) { /* reflets optionnels */ }

const hemi = new THREE.HemisphereLight(0xbcd8ff, 0x3a3448, 0.9);
scene.add(hemi);
const sun = new THREE.DirectionalLight(0xffffff, 2.2);
sun.castShadow = !isTouch;
sun.shadow.mapSize.set(2048, 2048);
sun.shadow.camera.left = -110; sun.shadow.camera.right = 110;
sun.shadow.camera.top = 110; sun.shadow.camera.bottom = -110;
sun.shadow.camera.near = 1; sun.shadow.camera.far = 600;
sun.shadow.bias = -0.0004;
sun.shadow.camera.updateProjectionMatrix();
const sunTarget = new THREE.Object3D();
scene.add(sunTarget); sun.target = sunTarget;
scene.add(sun);
const moon = new THREE.DirectionalLight(0x5560a0, 0);
scene.add(moon);

let fxOn = !isTouch;
let composer = null, bloomPass = null;
function buildComposer() {
  composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));
  bloomPass = new UnrealBloomPass(new THREE.Vector2(window.innerWidth, window.innerHeight), 0.38, 0.7, 0.82);
  composer.addPass(bloomPass);
  composer.addPass(new OutputPass());
  composer.setSize(window.innerWidth, window.innerHeight);
}
buildComposer();

const fx = new FX(scene);
const audio = new GameAudio();
const world = buildWorld(scene);
const rayBlocked = makeRayTester(world.colliders);

const player = new Player(scene);
player.pos.set(10, 0, 4);
const starterCar = new Vehicle(scene, 'sports', new THREE.Vector3(10, 0, 12), 0, false);
player.parked.push(starterCar);

const traffic = new Traffic(scene, world.colliders, isTouch ? (smallPhone ? 16 : 26) : 36, isTouch ? (smallPhone ? 12 : 20) : 38);
const peds = new Peds(scene, isTouch ? (smallPhone ? 60 : 110) : 240);
const police = new Police(scene, fx, audio);
const hud = new HUD();
const phone = new Phone(onPhoneAction);
const weather = new Weather(scene);
weather.notify = (msg) => hud.notify(msg);
weather.onThunder = () => audio.thunder();
const animals = new Animals(scene, isTouch ? (smallPhone ? 4 : 6) : 10, isTouch ? (smallPhone ? 12 : 18) : 32);
phone.setAssets(world.minimapCanvas);
phone.player = player;
phone.properties = world.PROPERTIES;
phone.fxOn = fxOn;
peds.fx = fx;

// ---------- pickups & mission & waypoints ----------
const moneyMat = new THREE.MeshStandardMaterial({
  color: 0x2fe06a, emissive: 0x1fae4a, emissiveIntensity: 0.8, metalness: 0.6, roughness: 0.3
});
const pickups = [];
for (let n = 0; n < 40; n++) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.8, 0.8), moneyMat);
  m.castShadow = true;
  m.position.copy(randomRoadPoint()); m.position.y = 0.8;
  scene.add(m); pickups.push(m);
}
const beam = new THREE.Mesh(
  new THREE.CylinderGeometry(3, 3, 60, 20, 1, true),
  new THREE.MeshBasicMaterial({
    color: 0xff2d95, transparent: true, opacity: 0.26,
    blending: THREE.AdditiveBlending, side: THREE.DoubleSide, depthWrite: false
  })
);
beam.position.y = 30;
const ring = new THREE.Mesh(new THREE.TorusGeometry(3, 0.25, 8, 32),
  new THREE.MeshBasicMaterial({ color: 0xffa0d0, toneMapped: false }));
ring.rotation.x = -Math.PI / 2; ring.position.y = 0.4;
const checkpointGroup = new THREE.Group();
checkpointGroup.add(beam); checkpointGroup.add(ring);
checkpointGroup.position.copy(randomRoadPoint());
scene.add(checkpointGroup);

const waypointBeam = new THREE.Mesh(
  new THREE.CylinderGeometry(2, 2, 80, 16, 1, true),
  new THREE.MeshBasicMaterial({
    color: 0x35f0e0, transparent: true, opacity: 0.22,
    blending: THREE.AdditiveBlending, side: THREE.DoubleSide, depthWrite: false
  })
);
waypointBeam.position.y = 40; waypointBeam.visible = false;
scene.add(waypointBeam);

// ---------- input clavier/souris ----------
const keys = {};
let yaw = 0, pitch = 0.12;
let pointerLocked = false;
const input = {
  fire: false, forward: 0, back: 0, left: 0, right: 0, run: false,
  handbrake: false, boost: false, steer: 0, throttle: 0, brakeInput: 0
};
const noiseEvents = [];

addEventListener('keydown', e => {
  keys[e.code] = true;
  if (!started || player.wasted || player.busted) return;
  if (e.code === 'KeyF') toggleVehicleAct();
  if (e.code === 'KeyC') camMode = (camMode + 1) % 3;
  if (e.code === 'KeyT') togglePhoneAct();
  if (e.code === 'KeyH' && !player.cuffed) { player.surrender = true; hud.notify('Tu te rends…'); }
  if (/^Digit[1-9]$/.test(e.code)) {
    const idx = +e.code.slice(-1) - 1;
    if (player.weapons[idx].ammo > 0 || WEAPONS[idx].ammo === Infinity) player.weaponIdx = idx;
    else hud.notify('Arme non possédée — vois avec Léon');
  }
  if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) e.preventDefault();
});
addEventListener('keyup', e => keys[e.code] = false);

renderer.domElement.addEventListener('click', () => {
  if (started && !phone.open && !isTouch) renderer.domElement.requestPointerLock();
});
document.addEventListener('pointerlockchange', () => {
  pointerLocked = document.pointerLockElement === renderer.domElement;
});
document.addEventListener('mousemove', e => {
  if (!pointerLocked) return;
  yaw -= e.movementX * 0.0026;
  pitch = Math.max(-0.5, Math.min(1.1, pitch + e.movementY * 0.0022));
});
document.addEventListener('mousedown', e => {
  if (pointerLocked && e.button === 0) input.fire = true;
});
document.addEventListener('mouseup', e => {
  if (e.button === 0) input.fire = false;
});
let camMode = 0;

// ---------- input tactile ----------
const joyVec = { x: 0, y: 0 };
if (isTouch) {
  const touchEl = document.getElementById('touch');
  let joyId = null, lookId = null, joyCX = 0, joyCY = 0, lastLX = 0, lastLY = 0;
  const joy = document.getElementById('joy'), knob = document.getElementById('joy-knob');

  touchEl.addEventListener('touchstart', e => {
    for (const t of e.changedTouches) {
      const tgt = t.target.closest?.('.tbtn');
      if (tgt) continue;
      if (t.clientX < window.innerWidth * 0.45 && joyId === null) {
        joyId = t.identifier;
        joyCX = t.clientX; joyCY = t.clientY;
      } else if (lookId === null) {
        lookId = t.identifier; lastLX = t.clientX; lastLY = t.clientY;
      }
    }
  }, { passive: true });
  touchEl.addEventListener('touchmove', e => {
    for (const t of e.changedTouches) {
      if (t.identifier === joyId) {
        let dx = t.clientX - joyCX, dy = t.clientY - joyCY;
        const len = Math.hypot(dx, dy), max = 55;
        if (len > max) { dx *= max / len; dy *= max / len; }
        knob.style.transform = `translate(${dx}px, ${dy}px)`;
        joyVec.x = dx / max; joyVec.y = dy / max;
      } else if (t.identifier === lookId) {
        yaw -= (t.clientX - lastLX) * 0.005;
        pitch = Math.max(-0.5, Math.min(1.1, pitch + (t.clientY - lastLY) * 0.004));
        lastLX = t.clientX; lastLY = t.clientY;
      }
    }
  }, { passive: true });
  const end = e => {
    for (const t of e.changedTouches) {
      if (t.identifier === joyId) { joyId = null; joyVec.x = joyVec.y = 0; knob.style.transform = ''; }
      if (t.identifier === lookId) lookId = null;
    }
  };
  touchEl.addEventListener('touchend', end);
  touchEl.addEventListener('touchcancel', end);

  let runToggle = false;
  document.querySelectorAll('.tbtn').forEach(b => {
    b.addEventListener('touchstart', e => {
      e.preventDefault();
      const act = b.dataset.t;
      if (act === 'fire') input.fire = true;
      if (act === 'run') { runToggle = !runToggle; input.run = runToggle; }
      if (act === 'use') {
        if (started && !player.wasted && !player.busted) {
          if (!interact()) {
            if (player.vehicle) player.exitVehicle(ctx);
            else if (!player.enterNearestVehicle(ctx)) hud.notify('Rien à faire ici');
          }
        }
      }
      if (act === 'phone') { phone.toggle(); }
      if (act === 'cam') camMode = (camMode + 1) % 3;
      if (act === 'wpn') cycleWeapon(1);
      if (act === 'crouch' && started && !player.cuffed) { player.surrender = true; hud.notify('Tu te rends…'); }
    }, { passive: false });
    b.addEventListener('touchend', e => { if (b.dataset.t === 'fire') input.fire = false; });
  });
}

// ---------- téléphone ----------
function onPhoneAction(action, arg) {
  const p = player;
  const gun = /^buy-(\d+)$/.test(action) && action !== 'buy-ammo' ? +action.slice(4) : null;
  const food = action.startsWith('food-') ? action.slice(5) : null;
  const propAct = action.startsWith('prop-') ? world.PROPERTIES[+action.slice(5)] : null;

  switch (true) {
    case action === 'waypoint':
      waypointBeam.visible = true;
      waypointBeam.position.set(arg.x, 40, arg.z);
      hud.notify('GPS activé');
      break;
    case action === 'taxi': {
      if (!phone.waypoint) { hud.notify('Place d’abord un GPS sur la carte'); break; }
      if (p.money < 100) { hud.notify('Pas assez d’argent'); break; }
      p.money -= 100;
      const dest = nearestRoadPoint(phone.waypoint.x, phone.waypoint.z);
      if (p.vehicle) { p.vehicle.pos.copy(dest).add(new THREE.Vector3(2, 0, 0)); p.vehicle.vf = 0; }
      p.pos.copy(dest);
      snapCam();
      hud.notify('Taxi : bien arrivé (-100 $)');
      break;
    }
    case action === 'heal':
      if (p.money < 200) { hud.notify('Pas assez d’argent'); break; }
      p.money -= 200; p.health = 100;
      hud.notify('Soigné par Dr Nina');
      break;
    case action === 'bribe':
      if (p.money < 2000) { hud.notify('Pas assez d’argent'); break; }
      p.money -= 2000; police.clear();
      hud.notify('Le Fixeur a effacé tes étoiles');
      break;
    case action === 'spawn': {
      if (p.money < 5000) { hud.notify('Pas assez d’argent'); break; }
      p.money -= 5000;
      const spot = nearestRoadPoint(p.pos.x + 8, p.pos.z);
      player.parked.push(new Vehicle(scene, 'sports', spot, 0, false));
      hud.notify('Sportive livrée près de toi');
      break;
    }
    case action === '911':
      police.addCrime(120);
      hud.notify('Tu as fait de ton mieux…');
      break;
    case action === 'buy-ammo':
      if (p.money < 300) { hud.notify('Pas assez d’argent'); break; }
      p.money -= 300; p.addAmmo(90);
      hud.notify('Munitions rechargées');
      break;
    case !!gun: {
      const g = { 1: 150, 2: 300, 3: 250, 4: 400, 5: 800, 6: 1200, 7: 1800, 8: 1100, 9: 2500, 10: 8000, 11: 8000, 12: 3500 }[gun];
      if (p.money < g) { hud.notify('Pas assez d’argent'); break; }
      p.money -= g; p.giveWeapon(gun);
      hud.notify(WEAPONS[gun].name + ' acheté !');
      break;
    }
    case !!food: {
      const f = { burger: [10, 0, 45], soda: [5, 45, 0], pizza: [15, 0, 80], coffee: [4, 30, 0] }[food];
      if (p.money < f[0]) { hud.notify('Pas assez d’argent'); break; }
      p.money -= f[0];
      p.thirst = Math.min(100, p.thirst + f[1]);
      p.hunger = Math.min(100, p.hunger + f[2]);
      hud.notify('Miam. Livré par scooter 🛵');
      break;
    }
    case !!propAct: {
      const pr = propAct;
      if (pr.owned) { hud.notify(pr.name + ' est déjà à toi'); break; }
      const dist = p.pos.distanceTo(new THREE.Vector3(pr.x, 0, pr.z));
      if (dist > 30) { hud.notify('Rapproche-toi du panneau (' + Math.round(dist) + ' m)'); break; }
      const price = propPrice(pr);
      if (p.money < price) { hud.notify('Il te manque ' + (price - p.money) + ' $'); break; }
      p.money -= price;
      notaireOn = false;
      world.soldProp(pr);
      p.home = pr;
      hud.notify('🏠 ' + pr.name + ' est à toi ! Appuie sur E devant pour dormir');
      break;
    }
    case action === 'settime': dayT = ((arg - 6 + 24) % 24) / 24; break;
    case action === 'night': dayT = 0.8; break;
    case action === 'day': dayT = 0.3; break;
    case action === 'fx':
      fxOn = !fxOn;
      phone.fxOn = fxOn;
      break;
  }
}

// ---------- jours, nuits ----------
const C_TOP_DAY = new THREE.Color(0x2074c8), C_TOP_SET = new THREE.Color(0x4a2a7a), C_TOP_N = new THREE.Color(0x020410);
const C_HOR_DAY = new THREE.Color(0xbcd9ec), C_HOR_SET = new THREE.Color(0xff7a50), C_HOR_N = new THREE.Color(0x0c1230);
const SUN_DAY = new THREE.Color(0xfff4e0), SUN_SET = new THREE.Color(0xff7a3c);
const tmpA = new THREE.Color(), tmpB = new THREE.Color(), tmpC = new THREE.Color();
const smooth = (a, b, x) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const sunDir = new THREE.Vector3();

function updateSky(dt) {
  dayT = (dayT + dt / CYCLE) % 1;
  const ang = dayT * Math.PI * 2;
  const h = Math.sin(ang);
  const dayF = smooth(-0.08, 0.2, h);
  const night = 1 - dayF;
  const sunsetF = Math.max(0, 1 - Math.abs(h) * 5) * Math.max(0.05, dayF);

  tmpA.copy(C_HOR_N).lerp(tmpC.copy(C_HOR_DAY).lerp(C_HOR_SET, sunsetF), dayF);
  tmpB.copy(C_TOP_N).lerp(tmpC.copy(C_TOP_DAY).lerp(C_TOP_SET, sunsetF), dayF);
  world.skyState.mat.uniforms.horizonColor.value.copy(tmpA);
  world.skyState.mat.uniforms.topColor.value.copy(tmpB);

  sunDir.set(Math.cos(ang - Math.PI / 2), Math.max(0.03, h), 0.35).normalize();
  world.skyState.mat.uniforms.sunDir.value.copy(sunDir);

  const wMul = weather.lightMul;
  sun.intensity = Math.max(0, h) * 2.3 * wMul + weather.flash * 2.5;
  tmpA.copy(SUN_SET).lerp(SUN_DAY, smooth(0.05, 0.4, h));
  sun.color.copy(tmpA);
  hemi.intensity = (0.18 + dayF * 0.75) * wMul + weather.flash;
  moon.intensity = night * 0.3;
  moon.position.set(player.pos.x + 60, 130, player.pos.z + 50);
  scene.fog.color.copy(tmpA);
  scene.fog.density = ((smallPhone ? 0.0022 : isTouch ? 0.0018 : 0.0013) + night * 0.0004) * weather.fogMul;

  sun.position.copy(player.pos).addScaledVector(sunDir, 170);
  sun.position.y = Math.max(18, sun.position.y);
  sunTarget.position.copy(player.pos);

  if (player.vehicle) player.vehicle.headMat.opacity = night > 0.5 ? 1 : 0.5;

  world.update(performance.now() / 1000, night, player.pos.z);
  return night;
}

// ---------- cycle de vie ----------
let started = false;
let prevDayT = 0.13;
let dayT = 0.13;
const CYCLE = 240;
const camPos = new THREE.Vector3(14, 6, -16);
const camLook = new THREE.Vector3(10, 1, 4);
let camShake = 0;
let snapNext = true;
function snapCam() { snapNext = true; }

const ctx = {
  input, player, traffic, peds, police, fx, hud, audio,
  worldColliders: world.colliders,
  camera, get camYaw() { return yaw; },
  rayBlocked, scene, noiseEvents,
  get night() { return lastNight; },
  get wanted() { return police; },
  spawnRocket
};
let lastNight = 0;

// ---------- roquettes ----------
const rockets = [];
const rocketGeo = new THREE.ConeGeometry(0.16, 0.7, 8);
const rocketMat = new THREE.MeshBasicMaterial({ color: 0xffa040, toneMapped: false });
function spawnRocket(origin, dir) {
  const mesh = new THREE.Mesh(rocketGeo, rocketMat);
  mesh.position.copy(origin);
  mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.clone().normalize());
  scene.add(mesh);
  rockets.push({ mesh, dir: dir.clone().normalize(), speed: 52, life: 3 });
  audio.rocket();
  player.registerViolence();
}
function updateRockets(dt) {
  for (let i = rockets.length - 1; i >= 0; i--) {
    const r = rockets[i];
    r.life -= dt;
    const step = r.speed * dt;
    const nx = r.mesh.position.clone().addScaledVector(r.dir, step);
    let boom = r.life <= 0;
    if (nx.y < 0.2) boom = true;
    if (!boom) {
      const bd = rayBlocked(r.mesh.position, r.dir, step + 0.4);
      if (bd < step + 0.4) boom = true;
    }
    if (!boom) {
      r.mesh.position.copy(nx);
      r.dir.y -= dt * 0.25;
      if (Math.random() < 0.5) fx.spark(nx);
      for (const veh of [...traffic.vehicles, ...police.copCars]) {
        if (!veh.wrecked && veh.pos.distanceTo(nx) < 2.6) {
          boom = true; veh.wreck(fx, audio);
          if (veh.type === 'police') police.addCrime(120);
          traffic.remove(veh);
        }
      }
      for (const ped of peds.list) {
        if (!ped.dead && ped.pos.distanceTo(nx) < 2.2) { peds.kill(ped, true); }
      }
      for (const cop of [...police.cops, ...police.soldiers]) {
        if (!cop.dead && cop.pos.distanceTo(nx) < 2.6) {
          cop.kill(ctx); police.addCrime(60);
        }
      }
      if (police.heli && police.heli.pos.distanceTo(nx) < 4) {
        fx.explosion(police.heli.pos); scene.remove(police.heli.mesh); police.heli = null;
        police.addCrime(250); boom = true;
      }
    }
    if (boom) {
      fx.explosion(r.mesh.position);
      audio.explosion();
      explosionArea(r.mesh.position, 10);
      scene.remove(r.mesh);
      rockets.splice(i, 1);
    }
  }
}
function explosionArea(pos, radius) {
  for (const ped of peds.list) {
    if (!ped.dead && ped.pos.distanceTo(pos) < radius) {
      peds.kill(ped, true);
    }
  }
  for (const s of [...police.soldiers, ...police.cops]) {
    if (!s.dead && s.pos.distanceTo(pos) < radius) { s.kill(ctx); police.addCrime(120); }
  }
  for (const v of traffic.parked) {
    if (!v.wrecked && v.pos.distanceTo(pos) < radius * 0.8) v.wreck(fx, audio);
  }
  if (!player.wasted && player.pos.distanceTo(pos) < radius * 0.75) player.damage(45, ctx);
}

// ---------- interactions (E / bouton ✋) ----------
let promptAction = null;
function interact() {
  if (promptAction) {
    promptAction();
    return true;
  }
  const door = world.doorNearest(player.pos, 3);
  if (door) { door.target = door.target ? 0 : 1; audio.door(); return true; }
  const pr = world.propNearest(player.pos, 6);
  if (pr) {
    if (pr.owned) { sleep(pr); return true; }
    {
      const price = propPrice(pr);
      if (player.money >= price) {
        player.money -= price;
        notaireOn = false;
        world.soldProp(pr);
        player.home = pr;
        hud.notify('🏠 ' + pr.name + ' est à toi !');
        audio.cash();
        return true;
      }
      hud.notify('Il te manque ' + (price - player.money) + ' $ pour ' + pr.name);
    }
    return true;
  }
  return false;
}
function sleep(pr) {
  dayT = 0.04;
  player.health = 100;
  player.hunger = 100;
  player.thirst = 100;
  player.energy = 100;
  player.pos.set(pr.x, 0, pr.z + 2);
  snapCam();
  bank = Math.round(bank * 1.02);
  hud.notify('☀️ Nouvelle journée ! Repos complet' + (bank > 0 ? ' — banque : ' + fmt(bank) + ' $' : ''));
}

/* ---------- POI, commerces, métiers ---------- */
const POIS = [];
const fmt = (n) => n.toLocaleString('fr-FR');
let bank = 0;
let notaireOn = false;
const propPrice = (pr) => notaireOn ? Math.round(pr.price * 0.85 / 100) * 100 : pr.price;
function makeLabelTex(txt) {
  const cv = document.createElement('canvas'); cv.width = cv.height = 128;
  const c = cv.getContext('2d');
  c.font = '92px serif'; c.textAlign = 'center'; c.textBaseline = 'middle';
  c.fillText(txt, 64, 70);
  return new THREE.CanvasTexture(cv);
}
function addPOI(x, z, color, icon, prompt, act) {
  const group = new THREE.Group();
  const ring = new THREE.Mesh(new THREE.TorusGeometry(1.7, 0.15, 8, 28),
    new THREE.MeshBasicMaterial({ color, toneMapped: false }));
  ring.rotation.x = -Math.PI / 2; ring.position.y = 0.14;
  group.add(ring);
  const spr = new THREE.Sprite(new THREE.SpriteMaterial({
    map: makeLabelTex(icon), transparent: true, depthWrite: false
  }));
  spr.scale.set(2.4, 2.4, 1); spr.position.y = 3.1;
  group.add(spr);
  group.position.set(x, 0, z);
  scene.add(group);
  POIS.push({ x, z, icon, prompt, act, ring });
}
function poiNearest(pos, r = 3.6) {
  let best = null, bd = r;
  for (const poi of POIS) {
    const d = Math.hypot(poi.x - pos.x, poi.z - pos.z);
    if (d < bd) { bd = d; best = poi; }
  }
  return best;
}

const spend = (sum, msg, ok) => {
  if (player.money < sum) { hud.notify('Il te manque ' + fmt(sum - player.money) + ' $'); return; }
  player.money -= sum; audio.cash();
  if (ok) ok();
  hud.notify(msg);
};

const vendAction = () => {
  const drink = player.thirst <= player.hunger;
  spend(drink ? 5 : 8, drink ? '🥤 Soda — soif +45' : '🍫 Snack — faim +35', () => {
    if (drink) player.thirst = Math.min(100, player.thirst + 45);
    else player.hunger = Math.min(100, player.hunger + 35);
  });
};
const atmDeposit = () => {
  const d = Math.floor(player.money / 2);
  if (d < 1) { hud.notify('Rien à déposer'); return; }
  player.money -= d; bank += d; audio.cash();
  hud.notify('🏦 Déposé ' + fmt(d) + ' $ — banque : ' + fmt(bank) + ' $ (2 %/jour)');
};
const atmWithdraw = () => {
  if (bank < 1) { hud.notify('Compte vide'); return; }
  player.money += bank; audio.cash();
  hud.notify('🏦 Retiré ' + fmt(bank) + ' $'); bank = 0;
};
const marketAct = () => spend(60, '🛒 Courses faites — faim et soif au max', () => {
  player.hunger = 100; player.thirst = 100;
});
const mairieAct = () => {
  if (player.spouse) { hud.notify('💍 Tu es déjà marié !'); return; }
  if (player.money < 2500) { hud.notify('Mariage : 2 500 $ — amène un PNJ devant la mairie'); return; }
  let best = null, bd = 9;
  for (const pd of peds.list) {
    if (pd.dead || pd.aggressive || pd.sunbathe) continue;
    const d = pd.pos.distanceTo(player.pos);
    if (d < bd) { bd = d; best = pd; }
  }
  if (!best) { hud.notify('Amène un PNJ devant la mairie pour te marier'); return; }
  player.money -= 2500; best.spouse = true; player.spouse = true;
  audio.cash();
  hud.notify('💍 Félicitations ! Ton conjoint te suis partout');
};
const notaireAct = () => {
  if (notaireOn) { hud.notify('Tu bénéficies déjà de la remise'); return; }
  spend(400, '✍️ Remise notariale : −15 % sur ta prochaine propriété', () => { notaireOn = true; });
};
let concessionCar = 210 + ((Math.random() * 90) | 0);
function rotateConcession() { concessionCar = 210 + ((Math.random() * 90) | 0); }
const concessionPrompt = () => {
  const c = CATALOG[concessionCar];
  return 'Concession : ' + c.name + ' (' + c.cls + ') — ' + fmt(c.price) + ' $';
};
const concessionAct = () => {
  const c = CATALOG[concessionCar];
  if (player.money < c.price) { hud.notify('Pour la ' + c.name + ', il te manque ' + fmt(c.price - player.money) + ' $'); return; }
  player.money -= c.price; audio.cash();
  const spot = nearestRoadPoint(player.pos.x + 8, player.pos.z);
  const v = new Vehicle(scene, c.id, spot, 0, false);
  player.parked.push(v);
  hud.notify('🚗 ' + c.name + ' livrée ! Retourne au parking du jour');
};
const NEWPALETTE = [0xd9536b, 0x53a0d9, 0xe8c33a, 0x59d97c, 0xf2f2f2, 0x8a5ad9, 0xe8804a, 0x2c2c34, 0xff2d95, 0x35f0e0,
  0xb03040, 0x30b090, 0xc07030, 0x6060e0, 0xe030c0, 0x90b030, 0x3090a0, 0xa050a0, 0x505860, 0xe0e0f0,
  0x804020, 0x204080, 0x802020, 0x208040, 0xe06020, 0x4040f0, 0xf0f040, 0x30e0e0, 0xf060a0, 0x60f080];
const clothesAct = () => spend(1500, '👕 Nouvelle tenue Palm Collection !', () => {
  const chest = player.rig.torso.children[0];
  if (!chest.matClone) { chest.material = chest.material.clone(); chest.matClone = true; }
  chest.material.color.setHex(NEWPALETTE[(Math.random() * NEWPALETTE.length) | 0]);
});
const gearAct = () => spend(400, '🏏 Batte achetée ! L’artillerie reste chez Léon (téléphone)', () => {
  player.giveWeapon(2);
});
let beachShift = 0;
const beachAct = () => {
  beachShift++;
  if (beachShift % 2) spend(8, '🍦 Glace — soif +35, énergie +12', () => {
    player.thirst = Math.min(100, player.thirst + 35); player.energy = Math.min(100, player.energy + 12);
  });
  else spend(20, '🧴 Lotion — PV +15', () => { player.health = Math.min(100, player.health + 15); });
};
const HOTEL_PRICES = [0, 120, 260, 550, 1100, 2400];
const hotelAct = (st) => () => spend(HOTEL_PRICES[st],
  '🛏️ Nuit ' + '★'.repeat(st) + ' — reposé et en forme', () => {
    player.health = 100; player.energy = 100;
    player.hunger = Math.min(100, player.hunger + 40 + st * 12);
    player.thirst = Math.min(100, player.thirst + 40 + st * 12);
  });

let job = null, jobWorkT = 0;
const jobBeam = new THREE.Mesh(new THREE.CylinderGeometry(2.4, 2.4, 70, 16, 1, true),
  new THREE.MeshBasicMaterial({
    color: 0xffd23f, transparent: true, opacity: 0.24,
    blending: THREE.AdditiveBlending, side: THREE.DoubleSide, depthWrite: false
  }));
jobBeam.position.y = 35; jobBeam.visible = false;
scene.add(jobBeam);
function startJob(kind) {
  if (job) { hud.notify('Déjà un boulot en cours (annule au même point)'); return; }
  const target = randomRoadPoint();
  job = { kind, target, dist0: player.pos.distanceTo(target) };
  jobWorkT = 0;
  jobBeam.position.set(target.x, 35, target.z);
  jobBeam.visible = true;
  hud.notify({
    livreur: '🚚 Livraison : rejoint le colis jaune',
    chantier: '🧱 Chantier : reste sur le point de travail',
    taxi: '🚕 Course : roule jusqu’au client (en voiture)'
  }[kind]);
}
function cancelJob() { job = null; jobBeam.visible = false; hud.notify('Boulot annulé'); }
function finishJob(p) {
  player.money += p; audio.cash();
  hud.notify('💰 Boulot terminé : +' + p + ' $');
  job = null; jobBeam.visible = false;
}
function jobUpdate(dt) {
  if (!job) return;
  const d = player.pos.distanceTo(job.target);
  if (job.kind === 'chantier') {
    if (d < 4) {
      jobWorkT += dt;
      if (Math.random() < dt * 2) fx.spark(player.pos.clone().setY(1.2));
      if (jobWorkT > 6) finishJob(240 + ((Math.random() * 40) | 0));
    }
  } else if (d < 6) {
    if (job.kind === 'taxi' && !player.vehicle) return;
    finishJob(job.kind === 'taxi' ? 120 + Math.round(job.dist0) : 180);
  }
}

/* enregistrement des POI */
const BEACH_SHOP_X = HALF - 16;
const PRISON = { x: rc(14), z: rc(2) };
addPOI(rc(8) + 7, rc(7), 0x35f0e0, '🥷', 'Distributeur — soda 5 $ / snack 8 $', vendAction);
addPOI(rc(4) + 7, rc(12), 0x35f0e0, '🥷', 'Distributeur — soda 5 $ / snack 8 $', vendAction);
addPOI(rc(12) + 7, rc(4), 0x35f0e0, '🥷', 'Distributeur — soda 5 $ / snack 8 $', vendAction);
addPOI(rc(9) + 7, rc(9), 0xffd23f, '🏦', 'Déposer la moitié de ton cash (2 %/jour)', atmDeposit);
addPOI(rc(3) + 7, rc(4), 0xffd23f, '🏦', 'Retirer ton argent de la banque', atmWithdraw);
addPOI(rc(7) + 7, rc(8), 0x59d97c, '🛒', 'Supermarché — courses 60 $', marketAct);
addPOI(rc(10) + 7, rc(10), 0xf0f0f0, '⛪️', 'Mairie — te marier (2 500 $)', mairieAct);
addPOI(rc(6) + 7, rc(6), 0xf0c035, '✍️', 'Notaire — remise propriété (400 $)', notaireAct);
addPOI(rc(11) + 7, rc(7), 0xff9a3c, '🚗', concessionPrompt, concessionAct);
addPOI(rc(5) + 7, rc(11), 0xff2d95, '👕', 'Vêtement — nouvelle tenue (1 500 $)', clothesAct);
addPOI(rc(12) + 7, rc(6), 0x9a5cff, '🏏', 'Équipement — batte (400 $)', gearAct);
addPOI(BEACH_SHOP_X, 60, 0x35f0e0, '🍦', 'Boutique de plage — glace / lotion', beachAct);
addPOI(BEACH_SHOP_X, -80, 0x35f0e0, '🧴', 'Boutique de plage — lotion / glace', beachAct);
for (let st = 1; st <= 5; st++)
  addPOI(rc(2) + 7, rc(4 + st), 0xf0e060, '🛏️', () => 'Hôtel ' + '★'.repeat(st) + ' — nuit ' + fmt(HOTEL_PRICES[st]) + ' $', hotelAct(st));
addPOI(PRISON.x + 6, PRISON.z, 0x8a8a9a, '🔒', 'Prison de Palm City (les récidivistes y finissent)', () => {});
addPOI(rc(8) + 7, rc(13), 0xffd23f, '🚚', () => job ? 'Annuler le boulot en cours' : 'Boulot : Livreur (~180 $)', () => job ? cancelJob() : startJob('livreur'));
addPOI(rc(3) + 7, rc(8), 0xffd23f, '🚕', () => job ? 'Annuler le boulot en cours' : 'Boulot : Chauffeur de taxi', () => job ? cancelJob() : startJob('taxi'));
addPOI(rc(13) + 7, rc(6), 0xffd23f, '🧱', () => job ? 'Annuler le boulot en cours' : 'Boulot : Chantier (~240 $)', () => job ? cancelJob() : startJob('chantier'));

/* ---------- entreprises achetables ---------- */
const BUSINESSES = [
  { name: 'Supermarché Palm', price: 85000, income: 700, x: rc(7) - 7, z: rc(8) + 4, owned: false },
  { name: 'Concession Vortek', price: 240000, income: 2100, x: rc(11) - 7, z: rc(7) - 4, owned: false },
  { name: 'Bar Le Palmier', price: 120000, income: 950, x: rc(10) - 7, z: rc(10) - 4, owned: false },
  { name: 'Hôtel Royal 3★', price: 320000, income: 2400, x: rc(2) + 7, z: rc(6) - 4, owned: false },
  { name: 'Kiosque de la plage', price: 60000, income: 520, x: BEACH_SHOP_X + 12, z: 20, owned: false },
  { name: 'Laverie Néon', price: 45000, income: 380, x: rc(5) + 7, z: rc(11) - 4, owned: false },
  { name: 'Garage des Docks', price: 150000, income: 1250, x: rc(13) - 7, z: rc(6) + 4, owned: false },
  { name: 'Kiosque à journaux', price: 30000, income: 240, x: rc(9) - 7, z: rc(9) - 4, owned: false },
  { name: 'Minimarket du Port', price: 70000, income: 600, x: rc(3) - 7, z: rc(4) + 4, owned: false },
  { name: 'Salle de sport FitPalm', price: 180000, income: 1400, x: rc(12) - 7, z: rc(6) + 4, owned: false }
];
function bizTexture(b) {
  const c = document.createElement('canvas'); c.width = 256; c.height = 256;
  const x = c.getContext('2d');
  x.fillStyle = '#101018'; x.fillRect(0, 0, 256, 256);
  x.font = '900 30px Arial'; x.fillStyle = '#ffd23c'; x.shadowColor = '#ffd23c'; x.shadowBlur = 20;
  x.fillText(b.owned ? 'À TOI' : 'À VENDRE', 128, 92);
  x.font = '900 40px Arial'; x.fillStyle = '#fdfdfd';
  x.fillText((b.owned ? '+' + b.income + ' $/j' : b.price.toLocaleString('fr-FR') + ' $'), 128, 170);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
for (const b of BUSINESSES) {
  const group = new THREE.Group();
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.08, 3.4, 6),
    new THREE.MeshStandardMaterial({ color: 0x4a5a2a }));
  pole.position.y = 1.7; group.add(pole);
  const sign = new THREE.Mesh(new THREE.PlaneGeometry(3, 3),
    new THREE.MeshBasicMaterial({ map: bizTexture(b), side: THREE.DoubleSide, toneMapped: false }));
  sign.position.y = 4; group.add(sign);
  group.position.set(b.x, 0, b.z);
  group.rotation.y = Math.random() * Math.PI;
  scene.add(group);
  b.sign = sign;
  addPOI(b.x + 2, b.z, 0xffb400, '💼',
    () => b.owned ? 'Ton entreprise : ' + b.name + ' (' + b.income + ' $/jour)'
      : 'Acheter ' + b.name + ' — ' + fmt(b.price) + ' $ (' + b.income + ' $/jour)',
    () => {
      if (b.owned) { hud.notify('Déjà à toi — ' + b.income + ' $/jour'); return; }
      if (player.money < b.price) { hud.notify('Il te manque ' + fmt(b.price - player.money) + ' $ pour ' + b.name); return; }
      player.money -= b.price; audio.cash();
      b.owned = true;
      b.sign.material.map.dispose();
      b.sign.material.map = bizTexture(b);
      hud.notify('💼 ' + b.name + ' est à toi ! Revenu : ' + b.income + ' $/jour');
    });
}
phone.businesses = BUSINESSES;

// ---------- collision joueur / voitures ----------
function carCollisions() {
  const all = [...traffic.vehicles, ...traffic.parked, ...police.copCars];
  const pv = player.vehicle;
  for (const v of all) {
    if (v === pv) continue;
    const d = v.pos.distanceTo(player.pos);
    if (d > 4.6) continue;
    const push = new THREE.Vector3(player.pos.x - v.pos.x, 0, player.pos.z - v.pos.z).normalize();
    if (pv) {
      pv.pos.addScaledVector(push, 0.12);
      const rel = Math.abs(pv.vf);
      if (rel > 12) {
        pv.applyDamage(rel * 0.5);
        v.applyDamage(rel * 0.25);
        fx.spark(player.pos.clone().setY(0.8));
        camShake = Math.min(1, camShake + 0.3);
        if (v.type === 'police') police.addCrime(30);
        audio.crash(rel);
        pv.vf *= 0.55;
      } else pv.vf *= 0.9;
    } else {
      player.pos.addScaledVector(push, 0.15);
      if (v.speed > 14 && !player.wasted) {
        const pedal = v.speed;
        player.damage(40, ctx);
        fx.blood(player.pos.clone().setY(1), push, 10);
        if (!player.vehicle) peds.knockPlayer?.();
      }
    }
  }
}

function pedCarHits() {
  const pv = player.vehicle;
  if (!pv || pv.speed < 11) return;
  for (const ped of peds.list) {
    if (ped.dead) continue;
    if (ped.pos.distanceTo(pv.pos) < 2.3) {
      ped.flyVel = pv.forward().clone().multiplyScalar(8).setY(7);
      peds.kill(ped, true);
      fx.blood(ped.pos.clone().setY(1), pv.forward(), 16);
      noiseEvents.push({ pos: ped.pos.clone(), t: 4 });
    }
  }
}

peds.onDeath = (ped, byPlayer) => {
  if (byPlayer) { police.addCrime(60); audio.yelp(); }
};

// ---------- manette ----------
let gpPrev = null;
function pollGamepad() {
  const pads = navigator.getGamepads ? navigator.getGamepads() : [];
  let gp = null;
  for (const p of pads) if (p && p.connected) { gp = p; break; }
  if (!gp) { gpPrev = null; return null; }
  const dz = v => Math.abs(v) < 0.18 ? 0 : v;
  const g = {
    lx: dz(gp.axes[0] || 0), ly: dz(gp.axes[1] || 0),
    rx: dz(gp.axes[2] || 0), ry: dz(gp.axes[3] || 0),
    a: !!(gp.buttons[0] && gp.buttons[0].pressed),
    b: !!(gp.buttons[1] && gp.buttons[1].pressed),
    x: !!(gp.buttons[2] && gp.buttons[2].pressed),
    y: !!(gp.buttons[3] && gp.buttons[3].pressed),
    lb: !!(gp.buttons[4] && gp.buttons[4].pressed),
    rb: !!(gp.buttons[5] && gp.buttons[5].pressed),
    lt: (gp.buttons[6] && gp.buttons[6].value) || 0,
    rt: (gp.buttons[7] && gp.buttons[7].value) || 0
  };
  const edge = (cur, key) => gpPrev && cur !== gpPrev[key] && cur;
  g.edge = {
    a: edge(g.a, 'a'), b: edge(g.b, 'b'), x: edge(g.x, 'x'), y: edge(g.y, 'y'),
    lb: edge(g.lb, 'lb'), rb: edge(g.rb, 'rb')
  };
  gpPrev = g;
  return g;
}
function toggleVehicleAct() {
  if (player.vehicle) player.exitVehicle(ctx);
  else if (!player.enterNearestVehicle(ctx)) hud.notify('Aucun véhicule à proximité');
}
function togglePhoneAct() { phone.toggle(); if (phone.open) document.exitPointerLock(); }
function cycleWeapon(dir = 1) {
  const N = WEAPONS.length;
  const step = dir > 0 ? 1 : N - 1;
  let n = player.weaponIdx;
  for (let i = 1; i <= N; i++) {
    const idx = (n + step * i) % N;
    if (player.weapons[idx].ammo > 0 || WEAPONS[idx].ammo === Infinity) { player.weaponIdx = idx; break; }
  }
}

// ---------- boucle ----------
const clock = new THREE.Clock();
let fpsS = 60, qualityT = 0, fpsShow = 0;

function animate() {
  requestAnimationFrame(animate);
  const dt = Math.min(Math.max(clock.getDelta(), 1e-4), 0.05);
  const t = performance.now() / 1000;

  fpsS += (1 / dt - fpsS) * 0.04;
  qualityT += dt;
  if (qualityT > 1.5) {
    qualityT = 0;
    const resFloor = smallPhone ? 0.45 : 0.55;
    if (fpsS < (smallPhone ? 42 : 55) && resScale > resFloor) {
      renderer.setPixelRatio(resScale = Math.max(resFloor, resScale * 0.88));
      applyRes();
    } else if (fpsS > 74 && resScale < resCap) {
      renderer.setPixelRatio(resScale = Math.min(resCap, resScale * 1.06));
      applyRes();
    }
  }
  fpsShow += dt;
  if (fpsShow > 0.5) { fpsShow = 0; document.getElementById('fps').textContent = Math.round(fpsS) + ' fps'; }

  for (const e of noiseEvents) e.t -= dt;
  if (prevDayT > dayT) {
    bank = Math.round(bank * 1.02);
    rotateConcession();
    if (started) {
      let bizSum = 0;
      for (const b of BUSINESSES) if (b.owned) bizSum += b.income;
      if (bizSum > 0) {
        player.money += bizSum;
        audio.cash();
        hud.notify('💼 Revenus de tes entreprises ce matin : +' + fmt(bizSum) + ' $');
      }
    }
  }
  prevDayT = dayT;
  phone.weather = weather.label;
  let i = noiseEvents.length;
  while (i--) if (noiseEvents[i].t <= 0) noiseEvents.splice(i, 1);

  if (started) {
    const inCar = !!player.vehicle;
    if (isTouch && !inCar) {
      input.forward = joyVec.y < -0.15;
      input.back = joyVec.y > 0.2;
      input.left = joyVec.x < -0.15;
      input.right = joyVec.x > 0.15;
    } else if (isTouch && inCar) {
      input.throttle = joyVec.y < -0.15 ? 1 : (joyVec.y > 0.25 ? -1 : 0);
      input.steer = Math.max(-1, Math.min(1, joyVec.x));
      input.handbrake = false;
    } else {
      const pressingBack = keys['KeyS'] || keys['ArrowDown'];
      if (inCar) {
        input.throttle = (keys['KeyW'] || keys['ArrowUp'] ? 1 : 0) + (pressingBack && player.vehicle.vf <= 0.5 ? -1 : 0);
        input.brakeInput = pressingBack && player.vehicle.vf > 0.5 ? 1 : 0;
        input.steer = (keys['KeyA'] || keys['ArrowLeft'] ? 1 : 0) - (keys['KeyD'] || keys['ArrowRight'] ? 1 : 0);
        input.handbrake = !!keys['Space'];
        input.boost = !!keys['ShiftLeft'] || !!keys['ShiftRight'];
      } else {
        input.forward = !!(keys['KeyW'] || keys['ArrowUp']);
        input.back = !!pressingBack;
        input.left = !!(keys['KeyA'] || keys['ArrowLeft']);
        input.right = !!(keys['KeyD'] || keys['ArrowRight']);
        input.run = !!keys['ShiftLeft'] || !!keys['ShiftRight'];
      }
    }
    if (!inCar) input.run = input.run || (isTouch && false);
    const gp = pollGamepad();
    if (gp) {
      yaw -= gp.rx * 2.6 * dt;
      pitch = Math.max(-0.5, Math.min(1.1, pitch + gp.ry * 1.9 * dt));
      if (inCar) {
        input.throttle = gp.rt;
        input.brakeInput = gp.lt;
        input.steer = gp.lx;
        input.handbrake = gp.a;
        input.boost = gp.rb;
      } else {
        input.forward = gp.ly < -0.25;
        input.back = gp.ly > 0.35;
        input.left = gp.lx < -0.25;
        input.right = gp.lx > 0.25;
        input.run = gp.lt > 0.35;
        input.fire = gp.rt > 0.3;
        input.throttle = 0; input.brakeInput = 0; input.steer = 0; input.handbrake = false;
      }
      if (gp.edge.x) toggleVehicleAct();
      if (gp.edge.y) togglePhoneAct();
      if (gp.edge.a && !inCar) interact();
      if (gp.edge.b && !player.cuffed) { player.surrender = true; hud.notify('Tu te rends…'); }
      if (gp.edge.rb) cycleWeapon(1);
      if (gp.edge.lb) cycleWeapon(-1);
    }
    input.throttle = Math.max(-1, Math.min(1, input.throttle));

    player.update(dt, ctx);
    if (phone.open) input.fire = false;

    const night = updateSky(dt);
    lastNight = night;
    world.setDt(dt);
    weather.update(dt, player.pos);
    for (const poi of POIS) poi.ring.rotation.z = t * 1.2;
    animals.update(dt, player);
    jobUpdate(dt);

    peds.update(dt, player);
    for (const e of noiseEvents) peds.panic(e.pos, 26, audio);
    traffic.update(dt, inCar ? player : null);
    police.update(dt, ctx);
    fx.update(dt);
    updateRockets(dt);
    carCollisions();
    pedCarHits();

    camShake = Math.max(0, camShake - dt * 2);
    if (player.vehicle) {
      audio.engine(player.vehicle.speed, Math.abs(input.throttle) + (input.boost ? 0.3 : 0),
        input.handbrake && player.vehicle.speed > 8);
    } else {
      audio.engine(0, 0, false);
    }

    let nearestCop = 1e9;
    for (const c of police.copCars) nearestCop = Math.min(nearestCop, c.pos.distanceTo(player.pos));
    for (const c of police.cops) nearestCop = Math.min(nearestCop, c.pos.distanceTo(player.pos));
    audio.updateSiren(dt, police.stars > 0, nearestCop);

    for (const p of pickups) {
      p.rotation.y += dt * 2.5;
      if (p.position.distanceTo(player.pos) < 3) {
        player.money += 100;
        audio.cash();
        hud.notify('+100 $');
        p.position.copy(randomRoadPoint()); p.position.y = 0.8;
      }
    }
    ring.scale.setScalar(1 + Math.sin(t * 4) * 0.25);
    beam.material.opacity = 0.22 + Math.sin(t * 4) * 0.08;
    if (checkpointGroup.position.distanceTo(player.pos) < 6) {
      player.money += 500;
      audio.cash();
      hud.notify('Mission réussie : +500 $');
      checkpointGroup.position.copy(randomRoadPoint());
    }

    /* prompts d'interaction */
    promptAction = null;
    let promptTxt = null;
    if (!player.wasted && !player.busted && !inCar) {
      const pr = world.propNearest(player.pos, 6);
      const door = world.doorNearest(player.pos, 3);
      if (pr && !pr.owned) {
        promptTxt = (isTouch ? '✋' : 'E') + ` — Acheter ${pr.name} (${propPrice(pr).toLocaleString('fr-FR')} $)`;
        promptAction = () => interactBuy(pr);
      } else if (pr && pr.owned) {
        promptTxt = (isTouch ? '✋' : 'E') + ' — Dormir chez toi';
        promptAction = () => sleep(pr);
      } else if (door) {
        promptTxt = (isTouch ? '✋' : 'E') + (door.target ? ' — Fermer la porte' : ' — Ouvrir la porte');
        promptAction = () => { door.target = door.target ? 0 : 1; audio.door(); };
      } else {
        const poi = poiNearest(player.pos);
        if (poi) {
          const label = typeof poi.prompt === 'function' ? poi.prompt() : poi.prompt;
          promptTxt = (isTouch ? '✋' : 'E') + ' — ' + label;
          promptAction = poi.act;
        }
      }
    }
    hud.prompt(promptTxt);

    /* arrestation affichage */
    if (player.busted) {
      if (player.arrestMode === 'violente') hud.big('ARRÊTÉ VIOLEMMENT', 'La matraque a parlé. -300 $');
      else hud.big('ARRÊTÉ', 'Mains derrière le dos… -300 $');
      if (player.deadT > 2.5) {
        if (police.stars >= 3) {
          player.respawn(PRISON.x, PRISON.z, 300, ctx, true);
          player.surrender = false;
          player.beatCount = 0;
          hud.big(null);
          snapCam();
          hud.notify('🔒 Prison de Palm City — sentence purgée, 300 $ d’amende');
        } else {
          player.respawn(-220, -300, 300, ctx);
          player.surrender = false;
          player.beatCount = 0;
          hud.big(null);
          snapCam();
          hud.notify('Libéré — ça t’apprendra');
        }
      }
    }
    if (player.wasted) {
      hud.big('À TERRE', player.deadT > 1 ? 'Frais d’hôpital : 500 $' : '…');
      if (player.deadT > 2.5) {
        player.respawn(-320, 260, 500, ctx);
        hud.big(null);
        snapCam();
        hud.notify('Tu te réveilles à l’hôpital');
      }
    }

    hud.update(dt, {
      speed: inCar ? player.vehicle.speed : 0,
      money: player.money, dayT,
      mapCanvas: world.minimapCanvas, player,
      trafficCars: traffic.vehicles,
      cops: police.copCars, copsFoot: police.cops, soldiers: police.soldiers,
      checkpoint: checkpointGroup.position, waypoint: phone.waypoint,
      stars: police.stars, evading: police.evadeT > 2 && police.stars > 0,
      onFoot: !inCar, aiming: pointerLocked && !inCar && !phone.open && !player.cuffed,
      weaponInfo: { w: WEAPONS[player.weaponIdx], ammo: player.weaponAmmo },
      hunger: player.hunger, thirst: player.thirst, energy: player.energy,
      weather: weather.label, spouse: !!player.spouse, bank: bank,
      properties: world.PROPERTIES
    });
  }

  /* caméra */
  const activeFwd = player.vehicle ? player.vehicle.forward()
    : new THREE.Vector3(Math.sin(yaw), 0, Math.cos(yaw));
  const speedK = player.vehicle ? Math.min(player.vehicle.speed / 55, 1) : 0;
  let desired, look;
  if (!player.vehicle) {
    const dir = new THREE.Vector3(
      Math.sin(yaw) * Math.cos(pitch), -Math.sin(pitch), Math.cos(yaw) * Math.cos(pitch)
    ).normalize();
    desired = player.pos.clone().add(new THREE.Vector3(0, 1.7, 0)).addScaledVector(dir, -3.6);
    desired.x += Math.cos(yaw) * 0.5; desired.z -= Math.sin(yaw) * 0.5;
    look = player.pos.clone().add(new THREE.Vector3(0, 1.5, 0)).addScaledVector(dir, 6);
  } else if (camMode === 0) {
    desired = player.pos.clone().addScaledVector(activeFwd, -10 - speedK * 3).add(new THREE.Vector3(0, 4.6 + speedK, 0));
    look = player.pos.clone().addScaledVector(activeFwd, 5).add(new THREE.Vector3(0, 1.4, 0));
  } else if (camMode === 1) {
    desired = player.pos.clone().addScaledVector(activeFwd, 0.6).add(new THREE.Vector3(0, 1.5, 0));
    look = player.pos.clone().addScaledVector(activeFwd, 12).add(new THREE.Vector3(0, 1, 0));
  } else {
    desired = player.pos.clone().add(new THREE.Vector3(0, 75, -38));
    look = player.pos.clone();
  }
  desired.x = Math.max(-LIM - 30, Math.min(LIM + 30, desired.x));
  desired.z = Math.max(-LIM - 30, Math.min(LIM + 30, desired.z));
  if (snapNext) { camPos.copy(desired); camLook.copy(look); snapNext = false; }
  const k = 1 - Math.exp(-dt * (player.vehicle && camMode === 1 ? 20 : 6));
  camPos.lerp(desired, k);
  camLook.lerp(look, 1 - Math.exp(-dt * 9));
  camera.position.copy(camPos);
  if (camShake > 0) camera.position.add(new THREE.Vector3(
    (Math.random() - 0.5) * camShake * 0.7, (Math.random() - 0.5) * camShake * 0.7,
    (Math.random() - 0.5) * camShake * 0.7));
  camera.lookAt(camLook);
  camera.fov = 66 + speedK * 10;
  camera.updateProjectionMatrix();

  phone.update(dt, dayT);

  if (fxOn && composer) composer.render();
  else renderer.render(scene, camera);
}
function applyRes() {
  if (composer) composer.setSize(window.innerWidth, window.innerHeight);
}
function interactBuy(pr) {
  const price = propPrice(pr);
  if (player.money >= price) {
    player.money -= price;
    notaireOn = false;
    world.soldProp(pr);
    player.home = pr;
    audio.cash();
    hud.notify('🏠 ' + pr.name + ' est à toi !');
  } else hud.notify('Il te manque ' + (price - player.money) + ' $');
}

if (isTouch) document.getElementById('touch').classList.remove('hidden');
document.getElementById('play').addEventListener('click', () => {
  document.getElementById('title').classList.add('hidden');
  hud.show();
  audio.start();
  started = true;
  hud.notify('Bienvenue à Palm City. F pour ta voiture, T pour le téléphone.');
  hud.setMission('Suis le faisceau rose — ou explore et achète ta villa');
  if (isTouch) {
    hud.big('📱 COMMANDES', 'Glisse ton pouce sur la molette ⚪ en bas à gauche pour marcher. Glisse sur le reste de l\'écran pour tourner la tête. Le bouton ✋ entre dans une voiture.');
    setTimeout(() => { if (!player.busted && !player.wasted) hud.big(null); }, 7000);
  }
});
document.getElementById('title').classList.add('ready');
animate();

addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
  applyRes();
});
