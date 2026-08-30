// ============================================================
// audio.js — 오디오 레이어
//
// BGM: assets/bgm/*.mp3 를 스트리밍 재생 + 크로스페이드.
//      파일이 없으면 조용히 넘어간다(스프라이트 폴백과 같은 철학).
// SE : 파일 없이 WebAudio로 합성 (칩튠 — 사각파 블립 + 노이즈).
//      나중에 실제 SE 파일로 갈아끼우려면 Sound.sfx()의 분기만 바꾸면 된다.
//
// 브라우저 자동재생 정책: 사용자 입력 전에는 AudioContext가 잠긴다.
// Input이 첫 입력에서 Sound.unlock()을 호출한다.
// ============================================================
const Sound = {
  ctx: null,
  masterGain: null, bgmGain: null, sfxGain: null,
  tracks: {},        // key → { el, node, gain, dead }
  currentKey: null,
  pendingBgm: null,  // 첫 사용자 입력 전 요청된 곡
  // Suno 곡은 마스터링이 크고(피크 0dB 근처) 합성 SE는 조용해서,
  // 기본값을 BGM 낮게 / SE 높게 잡아야 밸런스가 맞는다 (실청취로 조정)
  vol: { master: 1, bgm: 0.3, sfx: 1.0 },
  muted: false,
  voices: 0,         // 동시 발음 수 (폭주 방지)
  lastAt: {},        // 효과음별 마지막 재생 시각 (스로틀)

  // 첫 사용자 입력에서 호출 — 그 전엔 브라우저가 소리를 막는다
  unlock() {
    if (!this.ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      this.ctx = new AC();
      this.masterGain = this.ctx.createGain();
      this.bgmGain = this.ctx.createGain();
      this.sfxGain = this.ctx.createGain();
      this.bgmGain.connect(this.masterGain);
      this.sfxGain.connect(this.masterGain);
      this.masterGain.connect(this.ctx.destination);
      this.applyVol();
    }
    const resumed = this.ctx.state === 'suspended' ? this.ctx.resume() : null;

    // boot에서 예약한 타이틀곡은 반드시 이 사용자 입력 안에서 시작한다.
    // 다음 animation frame으로 미루면 autoplay 허용 구간을 벗어나 침묵할 수 있다.
    const pending = this.pendingBgm;
    if (pending) {
      this.pendingBgm = null;
      this.currentKey = null; // playBgm의 동일 키 조기 반환을 피한다
      this.playBgm(pending, 0.35);
    } else {
      this.retryCurrentBgm();
    }

    // 일부 브라우저는 AudioContext.resume()이 끝난 뒤에야 MediaElementSource를 흘린다.
    // 입력 안에서 한 번 시작하고, resume 완료 뒤 정지 상태면 한 번 더 보강한다.
    if (resumed && resumed.then) {
      resumed.then(() => this.retryCurrentBgm()).catch(() => {});
    }
  },

  retryCurrentBgm() {
    const cur = this.currentKey && this.tracks[this.currentKey];
    if (!cur || cur.dead || !cur.el.paused) return;
    try {
      const p = cur.el.play();
      if (p && p.catch) p.catch(() => {});
    } catch {}
  },

  applyVol() {
    if (!this.ctx) return;
    const m = this.muted ? 0 : this.vol.master;
    this.masterGain.gain.value = m;
    this.bgmGain.gain.value = this.vol.bgm;
    this.sfxGain.gain.value = this.vol.sfx;
  },

  save() {
    Meta.data.audio = { ...this.vol, muted: this.muted };
    Meta.save();
  },
  loadPrefs() {
    const a = Meta.data.audio;
    // 마이그레이션: sfx 0.7은 UI 단계(0/0.3/0.6/1.0)에 없는 값 = 옛 기본값이
    // 저장된 것 → 새 기본 밸런스(BGM 0.3 / SE 1.0)로 교체
    if (a && a.sfx !== 0.7) {
      this.vol.master = a.master ?? 1;
      this.vol.bgm = a.bgm ?? 0.3;
      this.vol.sfx = a.sfx ?? 1.0;
      this.muted = !!a.muted;
    } else if (a) {
      this.muted = !!a.muted;
    }
    this.applyVol();
  },

  // 0 → 0.3 → 0.6 → 1.0 순환 (UI 클릭용)
  cycleVol(which) {
    const steps = [0, 0.3, 0.6, 1.0];
    const cur = this.vol[which];
    const i = steps.findIndex(s => Math.abs(s - cur) < 0.01);
    this.vol[which] = steps[(i + 1) % steps.length];
    this.applyVol();
    this.save();
    if (which === 'sfx') this.sfx('uiMove');
  },
  toggleMute() {
    this.muted = !this.muted;
    this.applyVol();
    this.save();
  },

  // ---------------- BGM ----------------
  track(key) {
    if (this.tracks[key]) return this.tracks[key];
    const el = new window.Audio(`assets/bgm/${key}.mp3`);
    el.loop = true;
    el.preload = 'auto';
    const rec = { el, node: null, gain: null, dead: false };
    el.addEventListener('error', () => { rec.dead = true; });  // 파일 없음 → 조용히 무시
    this.tracks[key] = rec;
    return rec;
  },

  playBgm(key, fade = 1.2) {
    if (this.currentKey === key) return;
    if (!this.ctx) {
      this.pendingBgm = key;
      this.currentKey = key;
      if (key) this.track(key); // 모바일 첫 제스처 전에 요소와 URL을 미리 준비한다
      return;
    }
    const prev = this.currentKey;
    this.currentKey = key;
    if (prev) this.fadeOut(prev, fade);
    if (!key) return;

    const rec = this.track(key);
    if (rec.dead) return;
    try {
      if (!rec.node) {
        rec.node = this.ctx.createMediaElementSource(rec.el);
        rec.gain = this.ctx.createGain();
        rec.node.connect(rec.gain);
        rec.gain.connect(this.bgmGain);
      }
      const t = this.ctx.currentTime;
      rec.gain.gain.cancelScheduledValues(t);
      rec.gain.gain.setValueAtTime(0.0001, t);
      rec.gain.gain.linearRampToValueAtTime(1, t + fade);
      rec.el.currentTime = 0;
      const p = rec.el.play();
      // 자동재생 차단(NotAllowed)은 파일 문제가 아니다 — dead로 찍으면
      // 그 곡이 영영 침묵한다. 파일 오류는 el의 error 이벤트가 잡는다.
      if (p && p.catch) p.catch(() => {});
    } catch { rec.dead = true; }
  },

  fadeOut(key, fade = 1.2) {
    const rec = this.tracks[key];
    if (!rec || rec.dead || !rec.gain) return;
    const t = this.ctx.currentTime;
    rec.gain.gain.cancelScheduledValues(t);
    rec.gain.gain.setValueAtTime(rec.gain.gain.value, t);
    rec.gain.gain.linearRampToValueAtTime(0.0001, t + fade);
    setTimeout(() => { try { rec.el.pause(); } catch {} }, fade * 1000 + 50);
  },

  stopBgm(fade = 1.2) {
    if (this.currentKey) this.fadeOut(this.currentKey, fade);
    this.currentKey = null;
  },

  // ---------------- SE 합성 (칩튠) ----------------
  // 사각파 블립: 게임보이/패미컴식 짧은 음
  blip(freq, dur, opt = {}) {
    if (!this.ctx || this.muted) return;
    if (this.voices > 22) return;                 // 폭주 방지
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = opt.type || 'square';
    osc.frequency.setValueAtTime(freq, t);
    if (opt.to) osc.frequency.exponentialRampToValueAtTime(Math.max(20, opt.to), t + dur);
    const vol = (opt.vol ?? 0.25);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.005);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(g); g.connect(this.sfxGain);
    osc.start(t); osc.stop(t + dur + 0.02);
    this.voices++;
    osc.onended = () => { this.voices--; };
  },

  // 노이즈: 타격·폭발·물살
  noise(dur, opt = {}) {
    if (!this.ctx || this.muted) return;
    if (this.voices > 22) return;
    const t = this.ctx.currentTime;
    const n = Math.floor(this.ctx.sampleRate * dur);
    const buf = this.ctx.createBuffer(1, Math.max(1, n), this.ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / n);
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    const f = this.ctx.createBiquadFilter();
    f.type = opt.filter || 'bandpass';
    f.frequency.setValueAtTime(opt.freq ?? 1200, t);
    if (opt.freqTo) f.frequency.exponentialRampToValueAtTime(Math.max(60, opt.freqTo), t + dur);
    f.Q.value = opt.q ?? 1;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(opt.vol ?? 0.2, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f); f.connect(g); g.connect(this.sfxGain);
    src.start(t);
    this.voices++;
    src.onended = () => { this.voices--; };
  },

  // 아르페지오: 파워업·팡파레
  arp(freqs, step = 0.06, opt = {}) {
    freqs.forEach((f, i) => setTimeout(() => this.blip(f, opt.dur ?? 0.1, opt), i * step * 1000));
  },

  // 효과음 사전. 이름 하나로 호출 — 나중에 파일 SE로 갈아끼울 지점.
  sfx(name) {
    if (!this.ctx || this.muted || this.vol.sfx <= 0) return;
    // 연사·다중 피격이 겹치므로 종류별 최소 간격을 둔다
    const gap = { shot: 0.07, hit: 0.045, pearl: 0.035, kill: 0.05, graze: 0.08 }[name] ?? 0;
    const now = this.ctx.currentTime;
    if (gap && now - (this.lastAt[name] || 0) < gap) return;
    this.lastAt[name] = now;

    switch (name) {
      case 'shot':      this.blip(880, 0.05, { to: 620, vol: 0.045 }); break;
      case 'hit':       this.noise(0.05, { freq: 2600, freqTo: 1400, vol: 0.08 }); break;
      case 'kill':      this.noise(0.16, { freq: 1800, freqTo: 260, vol: 0.15 });
                        this.blip(520, 0.1, { to: 180, vol: 0.08 }); break;
      case 'killBig':   this.noise(0.34, { freq: 1400, freqTo: 120, vol: 0.24, q: 0.6 });
                        this.blip(320, 0.26, { to: 90, vol: 0.14, type: 'triangle' }); break;
      case 'pearl':     this.blip(1320, 0.05, { to: 1760, vol: 0.05, type: 'triangle' }); break;
      case 'pearlBig':  this.arp([1046, 1318, 1568, 2093], 0.045, { dur: 0.09, vol: 0.1, type: 'triangle' }); break;
      case 'powerup':   this.arp([523, 659, 784, 1046, 1318], 0.055, { dur: 0.13, vol: 0.13 }); break;
      case 'playerHit': this.blip(400, 0.22, { to: 120, vol: 0.2 });
                        this.noise(0.18, { freq: 900, freqTo: 200, vol: 0.14 }); break;
      case 'playerDown':this.blip(300, 0.7, { to: 60, vol: 0.24, type: 'sawtooth' });
                        this.noise(0.6, { freq: 700, freqTo: 90, vol: 0.16, q: 0.5 }); break;
      case 'shield':    this.arp([880, 1174, 1568], 0.05, { dur: 0.14, vol: 0.15, type: 'triangle' }); break;
      case 'sonar':     this.blip(180, 0.9, { to: 1400, vol: 0.2, type: 'sine' });
                        this.noise(0.7, { freq: 400, freqTo: 3000, vol: 0.16, filter: 'lowpass', q: 0.7 }); break;
      case 'warn':      this.blip(660, 0.16, { vol: 0.2 });
                        setTimeout(() => this.blip(880, 0.16, { vol: 0.2 }), 190);
                        setTimeout(() => this.blip(660, 0.16, { vol: 0.2 }), 380);
                        setTimeout(() => this.blip(880, 0.24, { vol: 0.2 }), 570); break;
      case 'phase':     this.arp([392, 523, 659, 784, 1046], 0.05, { dur: 0.14, vol: 0.16 }); break;
      case 'bossDeath': this.noise(0.6, { freq: 1600, freqTo: 100, vol: 0.24, q: 0.5 });
                        this.arp([523, 659, 784, 1046, 1318, 1568], 0.09, { dur: 0.2, vol: 0.14, type: 'triangle' }); break;
      case 'clear':     this.arp([523, 659, 784, 1046, 784, 1046, 1318], 0.11, { dur: 0.24, vol: 0.16 }); break;
      case 'graze':     this.blip(1980, 0.03, { vol: 0.035, type: 'triangle' }); break;
      case 'uiMove':    this.blip(740, 0.04, { vol: 0.08, type: 'triangle' }); break;
      case 'uiSelect':  this.blip(988, 0.07, { to: 1319, vol: 0.1 }); break;
      case 'buy':       this.arp([784, 1046, 1319], 0.05, { dur: 0.1, vol: 0.12, type: 'triangle' }); break;
      case 'deny':      this.blip(220, 0.14, { to: 150, vol: 0.12, type: 'sawtooth' }); break;
      case 'ride':      this.arp([392, 523, 659, 784], 0.07, { dur: 0.16, vol: 0.12, type: 'triangle' }); break;
      default: break;
    }
  },
};
