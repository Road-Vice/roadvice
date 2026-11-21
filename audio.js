export class GameAudio {
  constructor() {
    this.ctx = null;
    this.sirenOn = false;
    this.heliOn = false;
    this.sirenPhase = 0;
  }

  start() {
    if (this.ctx) { this.ctx.resume(); return; }
    const C = window.AudioContext || window.webkitAudioContext;
    if (!C) return;
    const ctx = this.ctx = new C();
    this.master = ctx.createGain(); this.master.gain.value = 0.5;
    this.master.connect(ctx.destination);

    this.engGain = ctx.createGain(); this.engGain.gain.value = 0;
    const engFilter = ctx.createBiquadFilter();
    engFilter.type = 'lowpass'; engFilter.frequency.value = 500;
    this.engFilter = engFilter;
    this.eng1 = ctx.createOscillator(); this.eng1.type = 'sawtooth'; this.eng1.frequency.value = 60;
    this.eng2 = ctx.createOscillator(); this.eng2.type = 'square'; this.eng2.frequency.value = 30;
    this.eng1.connect(engFilter); this.eng2.connect(engFilter);
    engFilter.connect(this.engGain); this.engGain.connect(this.master);
    this.eng1.start(); this.eng2.start();

    const len = ctx.sampleRate;
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    this.noiseBuf = buf;

    const skidNoise = ctx.createBufferSource();
    skidNoise.buffer = buf; skidNoise.loop = true;
    const nf = ctx.createBiquadFilter(); nf.type = 'bandpass'; nf.frequency.value = 950;
    this.skidGain = ctx.createGain(); this.skidGain.gain.value = 0;
    skidNoise.connect(nf); nf.connect(this.skidGain); this.skidGain.connect(this.master);
    skidNoise.start();

    this.sirenGain = ctx.createGain(); this.sirenGain.gain.value = 0;
    this.sirenOsc = ctx.createOscillator(); this.sirenOsc.type = 'square'; this.sirenOsc.frequency.value = 720;
    const sf = ctx.createBiquadFilter(); sf.type = 'lowpass'; sf.frequency.value = 1500;
    this.sirenOsc.connect(sf); sf.connect(this.sirenGain); this.sirenGain.connect(this.master);
    this.sirenOsc.start();

    const heliNoise = ctx.createBufferSource();
    heliNoise.buffer = buf; heliNoise.loop = true;
    const hf = ctx.createBiquadFilter(); hf.type = 'lowpass'; hf.frequency.value = 220;
    this.heliChop = ctx.createGain(); this.heliChop.gain.value = 0;
    this.heliGain = ctx.createGain(); this.heliGain.gain.value = 0;
    const lfo = ctx.createOscillator(); lfo.type = 'sine'; lfo.frequency.value = 16;
    this.lfoDepth = ctx.createGain(); this.lfoDepth.gain.value = 0.5;
    lfo.connect(this.lfoDepth); this.lfoDepth.connect(this.heliChop.gain);
    heliNoise.connect(hf); hf.connect(this.heliChop); this.heliChop.connect(this.heliGain);
    this.heliGain.connect(this.master);
    heliNoise.start(); lfo.start();
    this.lfoOsc = lfo;
  }

  engine(speed, throttle, skid) {
    if (!this.ctx) return;
    const f = 55 + speed * 3.2;
    this.eng1.frequency.value = f;
    this.eng2.frequency.value = f / 2;
    this.engFilter.frequency.value = 350 + speed * 40;
    this.engGain.gain.value = 0.03 + throttle * 0.05 + speed * 0.0012;
    this.skidGain.gain.value = skid ? 0.11 : 0;
  }

  updateSiren(dt, active, dist) {
    if (!this.ctx) return;
    const want = active && dist < 90;
    this.sirenGain.gain.value += ((want ? Math.max(0, 0.08 - dist * 0.0008) : 0) - this.sirenGain.gain.value) * Math.min(1, dt * 4);
    if (want) {
      this.sirenPhase += dt;
      this.sirenOsc.frequency.value = Math.sin(this.sirenPhase * 4.5) > 0 ? 740 : 980;
    }
  }

  heli(active) {
    if (!this.ctx) return;
    this.heliOn = active;
    this.heliGain.gain.value = active ? 0.14 : 0;
    this.lfoDepth.gain.value = active ? 0.05 : 0;
  }

  gunshot(vol = 1) {
    if (!this.ctx) return;
    const ctx = this.ctx, t = ctx.currentTime;
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuf;
    const f = ctx.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = 900;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.24 * vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.14);
    src.connect(f); f.connect(g); g.connect(this.master);
    src.start(t, Math.random() * 0.5, 0.16);
  }

  explosion() {
    if (!this.ctx) return;
    const ctx = this.ctx, t = ctx.currentTime;
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuf;
    const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 420;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.55, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 1.1);
    src.connect(f); f.connect(g); g.connect(this.master);
    src.start(t, Math.random() * 0.4, 1.1);
    const o = ctx.createOscillator(); o.type = 'sine';
    o.frequency.setValueAtTime(75, t);
    o.frequency.exponentialRampToValueAtTime(24, t + 0.8);
    const og = ctx.createGain();
    og.gain.setValueAtTime(0.5, t);
    og.gain.exponentialRampToValueAtTime(0.001, t + 0.85);
    o.connect(og); og.connect(this.master);
    o.start(t); o.stop(t + 0.9);
  }

  crash(force) {
    if (!this.ctx) return;
    const ctx = this.ctx, t = ctx.currentTime;
    const o = ctx.createOscillator(); o.type = 'triangle';
    const g = ctx.createGain();
    o.frequency.setValueAtTime(180, t);
    o.frequency.exponentialRampToValueAtTime(40, t + 0.25);
    g.gain.setValueAtTime(Math.min(0.5, force * 0.03), t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.3);
    o.connect(g); g.connect(this.master);
    o.start(t); o.stop(t + 0.32);
  }

  punch() {
    this.thud(160, 0.09, 0.18);
  }

  woosh() {
    if (!this.ctx) return;
    const ctx = this.ctx, t = ctx.currentTime;
    const src = ctx.createBufferSource(); src.buffer = this.noiseBuf;
    const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 600; f.Q.value = 2;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.06, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.18);
    src.connect(f); f.connect(g); g.connect(this.master);
    src.start(t, Math.random() * 0.5, 0.2);
  }

  thud(freq, dur, vol) {
    if (!this.ctx) return;
    const ctx = this.ctx, t = ctx.currentTime;
    const o = ctx.createOscillator(); o.type = 'sine';
    o.frequency.setValueAtTime(freq * 2, t);
    o.frequency.exponentialRampToValueAtTime(freq * 0.5, t + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur + 0.05);
    o.connect(g); g.connect(this.master);
    o.start(t); o.stop(t + dur + 0.1);
  }

  yelp() {
    if (!this.ctx) return;
    const ctx = this.ctx, t = ctx.currentTime;
    const o = ctx.createOscillator(); o.type = 'sawtooth';
    const f0 = 420 + Math.random() * 260;
    o.frequency.setValueAtTime(f0, t);
    o.frequency.exponentialRampToValueAtTime(f0 * 1.8, t + 0.12);
    o.frequency.exponentialRampToValueAtTime(f0 * 1.3, t + 0.3);
    const g = ctx.createGain();
    const lpf = ctx.createBiquadFilter(); lpf.type = 'lowpass'; lpf.frequency.value = 1600;
    g.gain.setValueAtTime(0.045, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.34);
    o.connect(lpf); lpf.connect(g); g.connect(this.master);
    o.start(t); o.stop(t + 0.36);
  }

  rocket() {
    if (!this.ctx) return;
    const ctx = this.ctx, t = ctx.currentTime;
    const src = ctx.createBufferSource(); src.buffer = this.noiseBuf;
    const f = ctx.createBiquadFilter(); f.type = 'lowpass';
    f.frequency.setValueAtTime(2400, t);
    f.frequency.exponentialRampToValueAtTime(300, t + 0.5);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.2, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.6);
    src.connect(f); f.connect(g); g.connect(this.master);
    src.start(t, Math.random() * 0.3, 0.7);
  }

  thunder() {
    if (!this.ctx) return;
    const ctx = this.ctx, t = ctx.currentTime;
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuf;
    const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 260;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(0.4, t + 0.08);
    g.gain.exponentialRampToValueAtTime(0.001, t + 1.6);
    src.connect(f); f.connect(g); g.connect(this.master);
    src.start(t, Math.random() * 0.3, 1.6);
  }

  door() {
    this.thud(90, 0.14, 0.14);
  }

  cash() {
    if (!this.ctx) return;
    const ctx = this.ctx, t = ctx.currentTime;
    [880, 1320].forEach((f, i) => {
      const o = ctx.createOscillator(); o.type = 'sine'; o.frequency.value = f;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.12, t + i * 0.07);
      g.gain.exponentialRampToValueAtTime(0.001, t + i * 0.07 + 0.18);
      o.connect(g); g.connect(this.master);
      o.start(t + i * 0.07); o.stop(t + i * 0.07 + 0.2);
    });
  }
}
