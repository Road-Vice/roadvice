import * as THREE from 'three';
import { WORLD, HALF } from './world.js';
import { WEAPONS } from './player.js';

const GUNPRICES = {
  'buy-1': { idx: 1, price: 150, label: 'Couteau' },
  'buy-2': { idx: 2, price: 300, label: 'Batte' },
  'buy-3': { idx: 3, price: 250, label: 'Pistolet' },
  'buy-4': { idx: 4, price: 400, label: 'Revolver' },
  'buy-5': { idx: 5, price: 800, label: 'Mitraillette' },
  'buy-6': { idx: 6, price: 1200, label: 'Fusil d’assaut' },
  'buy-7': { idx: 7, price: 1800, label: 'M4 tactique' },
  'buy-8': { idx: 8, price: 1100, label: 'Fusil à pompe' },
  'buy-9': { idx: 9, price: 2500, label: 'Sniper' },
  'buy-10': { idx: 10, price: 8000, label: 'Minigun' },
  'buy-11': { idx: 11, price: 8000, label: 'Lance-roquettes' },
  'buy-12': { idx: 12, price: 3500, label: 'Lance-grenades' }
};

const FOOD = {
  burger: { price: 10, hunger: 45, label: '🍔 Burger +45 faim' },
  soda: { price: 5, thirst: 45, label: '🥤 Soda +45 soif' },
  pizza: { price: 15, hunger: 80, label: '🍕 Pizza +80 faim' },
  coffee: { price: 4, thirst: 30, label: '☕ Café +30 soif' }
};

export class Phone {
  constructor(onAction) {
    this.el = document.getElementById('phone');
    this.content = document.getElementById('p-content');
    this.clock = document.getElementById('p-clock');
    this.open = false;
    this.player = null;
    this.properties = [];
    this.businesses = [];
    this.weather = null;
    this.apps = [];
    try { this.apps = JSON.parse(localStorage.getItem('rv-apps') || '[]'); } catch (e) { this.apps = []; }
    this.browserPath = null;
    this.onAction = onAction;
    document.getElementById('p-home').addEventListener('click', () => this.show('home'));
  }

  toggle() {
    this.open ? this.close() : this.show('home');
  }

  close() {
    this.open = false;
    this.el.classList.add('hidden');
  }

  show(page) {
    this.open = true;
    this.el.classList.remove('hidden');
    this.page = page;
    if (page === 'home') this.renderHome();
    else if (page === 'map') this.renderMap();
    else if (page === 'contacts') this.renderContacts();
    else if (page === 'guns') this.renderGuns();
    else if (page === 'food') this.renderFood();
    else if (page === 'homes') this.renderHomes();
    else if (page === 'settings') this.renderSettings();
    else if (page === 'browser') this.renderBrowser();
    else if (page === 'store') this.renderStore();
    else if (page === 'biz') this.renderBiz();
    else if (page === 'app-notes') this.renderNotes();
    else if (page === 'app-calc') this.renderCalc();
    else if (page === 'app-clock') this.renderClock();
  }

  renderHome() {
    this.content.innerHTML = `
      <div class="p-apps">
        <div class="p-app" data-app="map"><div class="ico" style="background:linear-gradient(135deg,#00b3ff,#0057ff)">🗺️</div><div>Carte GPS</div></div>
        <div class="p-app" data-app="contacts"><div class="ico" style="background:linear-gradient(135deg,#35f0e0,#009e8e)">📞</div><div>Contacts</div></div>
        <div class="p-app" data-app="guns"><div class="ico" style="background:linear-gradient(135deg,#ff2d95,#7a1055)">🔫</div><div>Armurerie</div></div>
        <div class="p-app" data-app="food"><div class="ico" style="background:linear-gradient(135deg,#ffb400,#ff6a00)">🍔</div><div>McPalm</div></div>
        <div class="p-app" data-app="homes"><div class="ico" style="background:linear-gradient(135deg,#59d97c,#1d6e35)">🏠</div><div>Immo</div></div>
        <div class="p-app" data-app="settings"><div class="ico" style="background:linear-gradient(135deg,#8f6bff,#3d1e8a)">⚙️</div><div>Réglages</div></div>
        <div class="p-app" data-app="browser"><div class="ico" style="background:linear-gradient(135deg,#40c8ff,#2050ff)">🌐</div><div>PalmNet</div></div>
        <div class="p-app" data-app="store"><div class="ico" style="background:linear-gradient(135deg,#59d97c,#0a7a3d)">🛍️</div><div>Palm Store</div></div>
        <div class="p-app" data-app="biz"><div class="ico" style="background:linear-gradient(135deg,#ffb400,#c04000)">💼</div><div>Mes entreprises</div></div>
        ${this.apps.map(a => `<div class="p-app" data-app="app-${a}"><div class="ico" style="background:linear-gradient(135deg,#666,#222)">${{ notes: '📝', calc: '🧮', clock: '⏰' }[a]}</div><div>${{ notes: 'Notes', calc: 'Calculatrice', clock: 'Horloge' }[a]}</div></div>`).join('')}
      </div>`;
    this.bindApps();
  }

  bindApps() {
    this.content.querySelectorAll('[data-app]').forEach(el =>
      el.addEventListener('click', () => this.show(el.dataset.app)));
  }

  renderMap() {
    this.content.innerHTML = `
      <div class="p-title">🗺️ Carte GPS</div>
      <canvas id="p-map" width="216" height="216"></canvas>
      <div class="p-info">Touche la carte pour placer un GPS (waypoint). Le taxi t'y emmènera.</div>`;
    const cv = this.content.querySelector('#p-map');
    const ctx = cv.getContext('2d');
    ctx.drawImage(this.mapCanvas, 0, 0, 384, 384, 0, 0, 216, 216);
    const pl = this.player ? this.player.pos : null;
    if (pl) {
      const mx = (pl.x + HALF) / WORLD * 216, my = (pl.z + HALF) / WORLD * 216;
      ctx.fillStyle = '#35f0e0';
      ctx.beginPath(); ctx.arc(mx, my, 4, 0, 7); ctx.fill();
    }
    for (const pr of this.properties) {
      const mx = (pr.x + HALF) / WORLD * 216, my = (pr.z + HALF) / WORLD * 216;
      ctx.fillStyle = pr.owned ? '#35f0e0' : '#ffd23c';
      ctx.fillRect(mx - 3, my - 3, 6, 6);
    }
    if (this.waypoint) {
      const mx = (this.waypoint.x + HALF) / WORLD * 216, my = (this.waypoint.z + HALF) / WORLD * 216;
      ctx.fillStyle = '#ff2d95';
      ctx.beginPath(); ctx.arc(mx, my, 5, 0, 7); ctx.fill();
    }
    cv.addEventListener('click', (e) => {
      const r = cv.getBoundingClientRect();
      const fxp = (e.clientX - r.left) / r.width;
      const fyp = (e.clientY - r.top) / r.height;
      this.waypoint = new THREE.Vector3((fxp - 0.5) * WORLD, 0, (fyp - 0.5) * WORLD);
      this.onAction('waypoint', this.waypoint);
      this.renderMap();
    });
  }

  renderContacts() {
    this.content.innerHTML = `
      <div class="p-title">📞 Contacts</div>
      <button class="p-btn" data-act="taxi">🚕 Taxi Vice <small>100 $ — t'emmène au GPS</small></button>
      <button class="p-btn" data-act="heal">🩺 Dr Nina <small>200 $ — remets-toi d'aplomb</small></button>
      <button class="p-btn" data-act="bribe">🕶️ Le Fixeur <small>2000 $ — fait oublier tes étoiles</small></button>
      <button class="p-btn" data-act="spawn">🏎️ Garage Deluxe <small>5000 $ — livre une sportive près de toi</small></button>
      <button class="p-btn" data-act="911">🚨 911 <small>Appelle la police sur toi… vraiment ?</small></button>`;
    this.bindActs();
  }

  renderGuns() {
    let html = '<div class="p-title">🔫 Armurerie Léon</div>';
    for (const [k, w] of Object.entries(GUNPRICES)) {
      const owned = this.player && (this.player.weapons[w.idx].ammo > 0 || WEAPONS[w.idx].ammo === Infinity);
      html += `<button class="p-btn" data-act="${k}">${WEAPONS[w.idx].icon} ${w.label} — ${w.price} $</button>`;
    }
    html += `<button class="p-btn" data-act="buy-ammo">📦 Munitions (+90) — 300 $</button>`;
    this.content.innerHTML = html;
    this.bindActs();
  }

  renderFood() {
    let html = '<div class="p-title">🍔 McPalm 24h</div>';
    for (const [k, f] of Object.entries(FOOD))
      html += `<button class="p-btn" data-act="food-${k}">${f.label} <small>${f.price} $ — livraison 30s</small></button>`;
    this.content.innerHTML = html;
    this.bindActs();
  }

  renderHomes() {
    let html = '<div class="p-title">🏠 Immobilier Palm</div>';
    for (const pr of this.properties) {
      const d = this.player ? Math.round(this.player.pos.distanceTo(new THREE.Vector3(pr.x, 0, pr.z))) : 999;
      html += `
        <button class="p-btn" data-act="prop-${this.properties.indexOf(pr)}" ${pr.owned ? 'disabled' : ''}>
          ${pr.owned ? '✅' : pr.marker?.visible ? '🟡' : '🏷️'} ${pr.name} <small>
          ${pr.owned ? 'À TOI — appuie sur E devant pour dormir' : pr.price.toLocaleString('fr-FR') + ' $ — ' + pr.type + ' (' + d + ' m)'}
        </small></button>`;
    }
    html += '<div class="p-info">Va sur place avec le bouton É pour acheter si tu es à moins de 8 m, ou achète à distance si tu es à moins de 30 m.</div>';
    this.content.innerHTML = html;
    this.bindActs();
  }

  renderSettings() {
    const h = this.hour !== undefined ? this.hour : 12;
    this.content.innerHTML = `
      <div class="p-title">⚙️ Réglages</div>
      <div class="p-info">Heure de Palm City</div>
      <input class="p-input" id="p-time" type="range" min="0" max="23" value="${h}">
      <div class="p-info" id="p-timeval">${h}:00</div>
      <button class="p-btn" data-act="night">🌙 Nuit directe</button>
      <button class="p-btn" data-act="day">☀️ Jour direct</button>
      <button class="p-btn" data-act="fx">✨ Effets avancés (bloom) : <span id="p-fx">${this.fxOn ? 'ON' : 'OFF'}</span></button>
      <div class="p-info">Qualité auto ${this.fps ? Math.round(this.fps) + ' fps' : ''}</div>`;
    this.bindActs();
    const slider = this.content.querySelector('#p-time');
    slider.addEventListener('input', () => {
      this.content.querySelector('#p-timeval').textContent = slider.value + ':00';
      this.onAction('settime', +slider.value);
    });
  }

  bindActs() {
    this.content.querySelectorAll('[data-act]').forEach(el =>
      el.addEventListener('click', () => this.onAction(el.dataset.act)));
  }

  /* -------- PalmNet : navigateur -------- */
  renderBrowser() {
    if (this.browserPath === 'news') return this.browserNews();
    if (this.browserPath === 'meteo') return this.browserMeteo();
    if (this.browserPath === 'tv') return this.browserTv();
    if (this.browserPath === 'annonces') return this.browserAnnonces();
    this.content.innerHTML = `
      <div class="p-title">🌐 PalmNet</div>
      <button class="p-btn" data-site="news">📰 PalmNews City</button>
      <button class="p-btn" data-site="meteo">/weather.palm 🌦️</button>
      <button class="p-btn" data-site="tv">📺 Palm TV — programme</button>
      <button class="p-btn" data-site="annonces">🏷️ Petites annonces</button>
      <div class="p-info">Le web de Palm City, en direct du quartier.</div>`;
    this.content.querySelectorAll('[data-site]').forEach(el =>
      el.addEventListener('click', () => { this.browserPath = el.dataset.site; this.show('browser'); }));
  }

  browserNews() {
    const h = Math.round(this.hour || 6);
    const headlines = [
      'Le maire annonce 120 nouvelles maisons — les prix flambent',
      'La police renforce les patrouilles après les émeutes du district violet',
      ' RECORD : une Falco Apex a flashé à 240 km/h sur le front de mer',
      'Le gang du Quartier Nord recrute… la mairie répond : « on marie tout le monde »'
    ];
    const meteo = this.weather ? this.weather.icon + ' ' + this.weather.name : 'inconnu';
    this.content.innerHTML = `
      <div class="p-title">📰 PalmNews City</div>
      <div class="p-info">${h}:00 — météo : ${meteo}</div>
      ${headlines.map(t => `<div class="p-info">• ${t.replace('\\u', '')}</div>`).join('')}
      <button class="p-btn" data-back="1">← Retour</button>`;
    this.bindBack();
  }

  browserMeteo() {
    const w = this.weather;
    this.content.innerHTML = `
      <div class="p-title">⛈️ weather.palm</div>
      <div class="p-info">Actuel : ${w ? w.icon + ' ' + w.name : 'inconnu'}</div>
      <div class="p-info">La météo change d’elle-même toutes les quelques minutes : pluie, orage, vent, neige, brouillard.</div>
      <button class="p-btn" data-back="1">← Retour</button>`;
    this.bindBack();
  }

  browserTv() {
    this.content.innerHTML = `
      <div class="p-title">📺 Palm TV</div>
      <div class="p-info">20:00 — Vice Investigations (saison 4)</div>
      <div class="p-info">21:30 — Les Rois du Chantier</div>
      <div class="p-info">23:00 — Palm City by Night (direct)</div>
      <div class="p-info">01:00 — Info du gang: marché nocturne</div>
      <button class="p-btn" data-back="1">← Retour</button>`;
    this.bindBack();
  }

  browserAnnonces() {
    this.content.innerHTML = `
      <div class="p-title">🏷️ Petites annonces</div>
      <div class="p-info">Vend Falco Cito 12 000 $ — première main, jamais flashé</div>
      <div class="p-info">Cherche guitariste pour le Bar Le Palmier — 300 $/soir</div>
      <div class="p-info">Perdu : perroquet bleu, répond au nom de Coco — récompense 500 $</div>
      <button class="p-btn" data-back="1">← Retour</button>`;
    this.bindBack();
  }

  bindBack() {
    this.content.querySelectorAll('[data-back]').forEach(el =>
      el.addEventListener('click', () => { this.browserPath = null; this.show('browser'); }));
  }

  /* -------- Palm Store -------- */
  install(name) {
    if (!this.apps.includes(name)) {
      this.apps.push(name);
      try { localStorage.setItem('rv-apps', JSON.stringify(this.apps)); } catch (e) {}
    }
    this.show('store');
  }

  renderStore() {
    const APPS = [
      { id: 'notes', label: '📝 Notes', desc: 'Prends des notes pendant tes missions' },
      { id: 'calc', label: '🧮 Calculatrice', desc: 'Pour compter tes millions' },
      { id: 'clock', label: '⏰ Horloge', desc: 'L\'heure de Palm City en direct' }
    ];
    let html = '<div class="p-title">🛍️ Palm Store</div>';
    for (const a of APPS) {
      if (this.apps.includes(a.id)) html += `<button class="p-btn" data-app2="${a.id}">✅ ${a.label} — ouvrir</button>`;
      else html += `<button class="p-btn" data-inst="${a.id}">${a.label} <small>${a.desc} — Installer</small></button>`;
    }
    this.content.innerHTML = html;
    this.content.querySelectorAll('[data-inst]').forEach(el =>
      el.addEventListener('click', () => this.install(el.dataset.inst)));
    this.content.querySelectorAll('[data-app2]').forEach(el =>
      el.addEventListener('click', () => this.show('app-' + el.dataset.app2)));
  }

  /* -------- applis installées -------- */
  renderNotes() {
    const saved = localStorage.getItem('rv-notes') || '';
    this.content.innerHTML = `
      <div class="p-title">📝 Notes</div>
      <textarea id="p-notes" class="p-input" style="height:110px">${saved}</textarea>
      <button class="p-btn" id="p-notes-save">💾 Enregistrer</button>`;
    this.content.querySelector('#p-notes-save').addEventListener('click', () => {
      localStorage.setItem('rv-notes', this.content.querySelector('#p-notes').value);
      this.content.querySelector('#p-notes-save').textContent = '✅ Enregistré';
    });
  }

  renderCalc() {
    this.content.innerHTML = `
      <div class="p-title">🧮 Calculatrice</div>
      <div class="p-info" id="calc-out">0</div>
      <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:4px">
        ${'7 8 9 / 4 5 6 * 1 2 3 - 0 C = +'.split(' ').map(k =>
          `<button class="p-btn" data-k="${k}">${k}</button>`).join('')}
      </div>`;
    const out = this.content.querySelector('#calc-out');
    let expr = '';
    this.content.querySelectorAll('[data-k]').forEach(el => el.addEventListener('click', () => {
      const k = el.dataset.k;
      if (k === 'C') expr = '';
      else if (k === '=') { try { expr = String(eval(expr) || 0); } catch (e) { expr = 'Erreur'; } }
      else expr += k;
      out.textContent = expr;
    }));
  }

  renderClock() {
    const h = this.hour !== undefined ? this.hour : 6;
    this.content.innerHTML = `
      <div class="p-title">⏰ Horloge</div>
      <div class="p-info" id="app-clock" style="font-size:26px;text-align:center">--:--</div>
      <div class="p-info">Heure locale de Palm City</div>`;
  }

  renderBiz() {
    let html = '<div class="p-title">💼 Mes entreprises</div>';
    let daily = 0;
    for (const b of this.businesses) {
      if (b.owned) daily += b.income;
      const d = this.player ? Math.round(this.player.pos.distanceTo(new THREE.Vector3(b.x, 0, b.z))) : 999;
      html += `<button class="p-btn" data-act="biz-${this.businesses.indexOf(b)}" ${b.owned ? 'disabled' : ''}>
        ${b.owned ? '✅' : '💼'} ${b.name} <small>
        ${b.owned ? 'À TOI — ' + b.income + ' $/jour' : b.price.toLocaleString('fr-FR') + ' $ — revenu ' + b.income + ' $/jour (' + d + ' m)'}
      </small></button>`;
    }
    html += `<div class="p-info">Revenu total : ${daily} $/jour — versé chaque matin.</div>`;
    this.content.innerHTML = html;
    this.bindActs();
  }

  update(dt, dayT) {
    if (!this.open) return;
    const hours = (dayT * 24 + 6) % 24;
    this.clock.textContent = String(Math.floor(hours)).padStart(2, '0') + ':' +
      String(Math.floor((hours % 1) * 60)).padStart(2, '0');
    this.hour = hours;
  }

  setAssets(mapCanvas) { this.mapCanvas = mapCanvas; }
}
