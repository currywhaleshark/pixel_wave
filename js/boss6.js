// ============================================================
// boss6.js — 보스 6호: 천둥 뱀장어 「우르릉」 (폭풍 수면, GDD 9.9)
// P1 축전 빔 → P2 낙뢰 소환 → P3 대파도 「대폭풍」
// 규칙: 가로 빔은 자기 높이의 줄을 쓸어버린다 — 스파크 예고를 보고 줄을 비켜라.
//       P3에선 해류가 2배로 강해져 탄막 전체가 크게 휜다.
// 톤: 허세 가득한 자칭 "폭풍의 왕". 목소리만 크다.
// ============================================================
const BOSS6_PATTERNS = {
  1: { id: 'ureu-charge-beam',  name: '축전 빔' },
  2: { id: 'ureu-bolt-call',    name: '낙뢰 소환' },
  3: { id: 'ureu-great-storm',  name: '대폭풍' },  // 대파도
  4: { id: 'ureu-twin-thunder', name: '진·대폭풍' },  // 하드 전용: 이중 낙뢰 빔
};

class BossUreu {
  constructor(game) {
    this.game = game;
    this.hp = CFG.boss6Hp;
    this.maxHp = CFG.boss6Hp;
    this.x = CFG.W + 90;
    this.y = CFG.H * 0.5;
    this.t = 0;
    this.anim = 0;
    this.phase = 0;
    this.scale = 1.05;
    this.telegraph = 0;
    this.mode = 'hover';       // hover | chargeTel | beam
    this.modeT = 2.2;
    this.beam = null;          // { y, strikeT }
    this.aimT = 1.6;
    this.boltT = 3.2;
    this.boltStep = 0;
    this.ringT = 2.4;
    this.sprayT = 0.8;
    this.beamCycleT = 6.5;
    this.transitionT = 0;
    this.dead = false;
    this.deathT = 0;
  }

  hpRatio() { return Math.max(0, this.hp / this.maxHp); }

  mercy() {
    const over = this.t - CFG.bossMercyTime;
    return (over > 0 ? 1 + Math.min(1.2, over / 45) : 1) * (this.game.D?.bossInt ?? 1);
  }

  takeDamage(dmg) {
    if (this.phase === 0 || this.transitionT > 0 || this.dead) return;
    this.hp -= dmg;
    const r = this.hpRatio();
    if (this.phase === 1 && r <= 0.66) this.enterPhase(2);
    else if (this.phase === 2 && r <= 0.33) this.enterPhase(3);
    else if (this.phase === 3 && this.game.diff >= 2 && r <= 0.18) this.enterPhase(4); // 하드: 진 대파도
    if (this.hp <= 0 && !this.dead) this.die();
  }

  enterPhase(p) {
    this.phase = p;
    this.transitionT = 1.2;
    this.mode = 'hover';
    this.beam = null;
    this.game.clearBulletsToPearls(false);
    if (p === 2) {
      this.game.message('"찌릿찌릿하지?! 그게 바로 왕의 위엄!!"', '#ffd76e');
      this.game.addBattery(1);
      this.game.phaseReward(this.x, this.y);
    } else if (p === 3) {
      this.game.message('"대폭풍이다아아—!! 우르르릉!!"', '#ffe9a8');
      this.game.stormScale = 2;   // 해류 2배 — 탄막이 크게 휜다
      this.game.addBattery(1);
      this.game.phaseReward(this.x, this.y);
    } else if (p === 4) {
      // 진 대파도: 이중 빔 — 자기 줄 + 너의 줄, 동시에
      this.game.message('"진정한 왕의!! 이중 낙뢰다아아!!"', '#fff3b0');
      this.game.addBattery(1);
      this.game.phaseReward(this.x, this.y);
    }
  }

  die() {
    this.dead = true;
    this.deathT = 0;
    Sound.sfx('bossDeath');
    this.beam = null;
    this.game.stormScale = 0;     // 폭풍이 잦아든다
    this.game.bolts = [];
    this.game.clearBulletsToPearls(true);
    for (let i = 0; i < 50; i++) {
      const a = Math.random() * 6.28, s = 60 + Math.random() * 250;
      this.game.pearls.push(new Pearl(this.x, this.y, { vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: 15, auto: true }));
    }
    for (let i = 0; i < 5; i++) {
      const a = Math.random() * 6.28;
      this.game.pearls.push(new Pearl(this.x, this.y, { vx: Math.cos(a) * 130, vy: Math.sin(a) * 130, big: true, life: 15, auto: true }));
    }
    this.game.say('"...오, 오늘은 봐준다! 왕은 관대하니까! 조심히 가라구!"', '"크윽... 오늘도 봐준 거다! 왕은 바쁘니까!"', '#a8ffcf');
  }

  update(dt) {
    this.t += dt; this.anim += dt;
    const g = this.game;

    if (this.dead) {
      this.deathT += dt;
      this.y -= 15 * dt;
      if (this.deathT > 2.6) g.victory();
      return;
    }

    if (this.phase === 0) {
      this.x -= 90 * dt;
      if (this.x <= CFG.W * 0.82) {
        this.x = CFG.W * 0.82;
        this.phase = 1;
        g.message('천둥 뱀장어 「우르릉」', '#ffd76e');
        g.say('"우르릉!! 폭풍의 왕님이 나가신다!!"', '"왔느냐! 왕은 언제나 준비되어 있다!!"', '#ffe9a8');
      }
      return;
    }

    if (this.transitionT > 0) { this.transitionT -= dt; return; }

    const m = this.mercy();
    if (this.telegraph > 0) this.telegraph -= dt;

    // ---- 가로 빔 사이클 (P1·P3 공용): 스파크 예고 → 자기 줄 빔 ----
    const doBeamCycle = (interval) => {
      if (this.mode === 'hover') {
        this.beamCycleT -= dt;
        if (this.beamCycleT <= 0) {
          this.mode = 'chargeTel';
          this.modeT = 0.95;
          if (g.dolphin && this.telegraph <= 0) this.telegraph = 0.95;
        }
      } else if (this.mode === 'chargeTel') {
        // 축전 스파크
        if (Math.random() < 0.5) {
          g.fx.push({ x: this.x + (Math.random() - 0.5) * 70, y: this.y + (Math.random() - 0.5) * 70,
                      vx: 0, vy: 0, life: 0.25, color: '#fff3b0' });
        }
        // 진 대파도(P4): 예고 시작 시 플레이어 줄 스냅샷 — 두 번째 빔의 줄
        if (this.phase === 4 && this.beamY2 === undefined) this.beamY2 = g.player.y;
        this.modeT -= dt;
        if (this.modeT <= 0) {
          this.mode = 'beam';
          this.beam = { y: this.y, strikeT: 0.55 };
          if (this.phase === 4) this.beam2 = { y: this.beamY2, strikeT: 0.55 };
          this.beamY2 = undefined;
          g.flashT = Math.max(g.flashT, 0.15);
          g.shake = Math.max(g.shake, 0.25);
        }
      } else if (this.mode === 'beam') {
        this.beam.strikeT -= dt;
        if (this.beam2) this.beam2.strikeT -= dt;
        // 빔 줄 판정 (이중 빔 포함)
        const pl = g.player;
        if (pl.bubble <= 0 && Math.abs(pl.y - this.beam.y) < 27 + CFG.playerHitR) pl.hit(g);
        if (this.beam2 && pl.bubble <= 0 && Math.abs(pl.y - this.beam2.y) < 27 + CFG.playerHitR) pl.hit(g);
        if (this.beam.strikeT <= 0) {
          this.beam = null;
          this.beam2 = null;
          this.mode = 'hover';
          this.beamCycleT = interval * m;
        }
      }
    };

    if (this.phase === 1) {
      // P1: 상하 이동 + 조준 스파크 + 축전 빔
      if (this.mode === 'hover') {
        this.x += (CFG.W * 0.82 - this.x) * Math.min(1, dt * 2);
        this.y = CFG.H * 0.5 + Math.sin(this.anim * 0.75) * 150;
        this.aimT -= dt;
        if (this.aimT <= 0) {
          this.aimT = 2.3 * m;
          g.bossAimed(this.x - 30, this.y, 150, 3, 0.24);
        }
      }
      doBeamCycle(5.6);
    } else if (this.phase === 2) {
      // P2: 낙뢰 소환 (플레이어 쪽으로 3연속 스윕) + 링 스파크
      this.x += (CFG.W * 0.82 - this.x) * Math.min(1, dt * 2);
      this.y = CFG.H * 0.5 + Math.sin(this.anim * 0.9) * 160;
      this.boltT -= dt;
      if (g.dolphin && this.boltT <= 0.5 && this.boltT > 0 && this.telegraph <= 0) this.telegraph = 0.5;
      if (this.boltT <= 0) {
        this.boltT = 4.2 * m;
        // 플레이어 위치 기준 스윕 3발 (스냅샷 — 움직이면 피해진다)
        const px = g.player.x / CFG.W;
        const dir = Math.random() < 0.5 ? 1 : -1;
        const bn = 3 + (g.diff >= 2 ? 1 : 0); // 하드: 낙뢰 4연 스윕
        for (let i = 0; i < bn; i++) {
          const frac = Math.max(0.06, Math.min(0.94, px + dir * (i - 1) * 0.12));
          g.bolts.push({ x: frac * CFG.W, w: CFG.boltW, telT: CFG.boltTelT + i * 0.35, strikeT: CFG.boltStrikeT, hitDone: false });
        }
      }
      this.ringT -= dt;
      if (this.ringT <= 0) {
        this.ringT = 2.9 * m;
        g.bossRing(this.x, this.y, 16, 108, Math.random() * 6.28);
      }
    } else if (this.phase >= 3) {
      // P3 대파도: 대폭풍 — 강화 해류에 휘는 스파크 + 낙뢰 파도 + 가끔 빔
      // 진 대파도(P4): 빔이 이중 — 자기 줄 + 플레이어 줄(예고 시점 스냅샷)
      if (this.mode === 'hover') {
        this.x += (CFG.W * 0.84 - this.x) * Math.min(1, dt * 2);
        this.y = CFG.H * 0.5 + Math.sin(this.anim * 0.7) * 130;
      }
      this.sprayT -= dt;
      if (this.sprayT <= 0) {
        this.sprayT = 0.55 * m;
        // 스파크 살포 — 해류에 실려 크게 휜다
        const a = Math.PI + (Math.random() - 0.5) * 1.6;
        g.ebullets.push({
          x: this.x - 20, y: this.y,
          vx: Math.cos(a) * 95, vy: Math.sin(a) * 95,
          r: CFG.ebR, kind: 'spike',
        });
      }
      this.boltT -= dt;
      if (this.boltT <= 0) {
        this.boltT = 4.8 * m;
        // 낙뢰 파도: 좌→우 또는 우→좌 스윕 (난이도로 발수 증가, 화면 폭은 유지)
        const ltr = Math.random() < 0.5;
        const wn = 5 + g.diff;
        for (let i = 0; i < wn; i++) {
          const step = 0.72 / (wn - 1);
          const frac = ltr ? 0.1 + i * step : 0.82 - i * step;
          g.bolts.push({ x: frac * CFG.W, w: CFG.boltW, telT: CFG.boltTelT + i * 0.3, strikeT: CFG.boltStrikeT, hitDone: false });
        }
      }
      doBeamCycle(7.2);
    }
  }

  draw(ctx) {
    // 가로 빔 (진 대파도에선 이중)
    for (const bm of [this.beam, this.beam2]) {
      if (!bm) continue;
      const a = Math.max(0, bm.strikeT / 0.55);
      ctx.save();
      const grad = ctx.createLinearGradient(0, bm.y - 27, 0, bm.y + 27);
      grad.addColorStop(0, 'rgba(255,240,150,0)');
      grad.addColorStop(0.5, `rgba(255,250,220,${0.6 * a})`);
      grad.addColorStop(1, 'rgba(255,240,150,0)');
      ctx.fillStyle = grad;
      ctx.fillRect(0, bm.y - 27, CFG.W, 54);
      ctx.strokeStyle = `rgba(255,255,255,${0.95 * a})`;
      ctx.lineWidth = 4;
      ctx.beginPath();
      let zx = CFG.W, zy = bm.y;
      ctx.moveTo(zx, zy);
      while (zx > 0) {
        zx -= 40 + Math.random() * 24;
        zy = bm.y + (Math.random() - 0.5) * 30;
        ctx.lineTo(zx, zy);
      }
      ctx.stroke();
      ctx.restore();
    }
    // 빔 예고: 자기 줄 표시 (+진 대파도: 플레이어 스냅샷 줄도)
    if (this.mode === 'chargeTel') {
      ctx.save();
      const blink = Math.floor(this.modeT * 12) % 2 === 0;
      ctx.fillStyle = `rgba(255,240,150,${blink ? 0.13 : 0.06})`;
      ctx.fillRect(0, this.y - 27, CFG.W, 54);
      if (this.beamY2 !== undefined) ctx.fillRect(0, this.beamY2 - 27, CFG.W, 54);
      ctx.restore();
    }

    ctx.save();
    ctx.translate(this.x, this.y);
    const s = this.scale;
    const R = 30 * s;
    if (this.dead) ctx.globalAlpha = Math.max(0, 1 - this.deathT / 2.6);

    // 힌트 예고 반짝
    if (this.telegraph > 0) {
      ctx.strokeStyle = `rgba(255, 240, 150, ${Math.min(1, this.telegraph)})`;
      ctx.lineWidth = 3;
      ctx.beginPath(); ctx.arc(0, 0, R + 55, 0, 6.28); ctx.stroke();
    }

    const drawStaticSparks = () => {
      if (this.mode !== 'chargeTel' && this.phase !== 3) return;
      ctx.strokeStyle = `rgba(255,243,176,${0.5 + Math.sin(this.anim * 18) * 0.4})`;
      ctx.lineWidth = 2;
      for (let i = 0; i < 3; i++) {
        const a = this.anim * 7 + i * 2.1;
        ctx.beginPath();
        ctx.moveTo(Math.cos(a) * R * 1.2, Math.sin(a) * R * 1.2);
        ctx.lineTo(Math.cos(a) * (R * 1.2 + 12), Math.sin(a) * (R * 1.2 + 12) + 5);
        ctx.stroke();
      }
    };

    // 완성 전신이 있으면 코드 몸통·머리·왕관을 중복해서 그리지 않는다.
    // x/y와 충돌 반경은 그대로이므로 피탄 판정은 기존 머리 크기를 유지한다.
    if (Sprites.draw(ctx, 'boss.ureu', 0, 0, { t: this.anim, scale: s })) {
      drawStaticSparks();
      ctx.restore();
      return;
    }

    // 몸통: 세로로 굽이치는 장어 (머리 아래로 이어짐)
    ctx.strokeStyle = '#3d4d6b';
    ctx.lineWidth = 26 * s;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(0, 0);
    for (let i = 1; i <= 7; i++) {
      const yy = i * 34;
      const xx = Math.sin(this.anim * 2.4 + i * 0.9) * 26 + 12 + i * 4;
      ctx.lineTo(xx, yy);
    }
    ctx.stroke();
    // 배 노란 줄무늬 (전기!)
    ctx.strokeStyle = 'rgba(255,215,110,0.75)';
    ctx.lineWidth = 7 * s;
    ctx.beginPath();
    ctx.moveTo(0, 4);
    for (let i = 1; i <= 7; i++) {
      const yy = i * 34;
      const xx = Math.sin(this.anim * 2.4 + i * 0.9) * 26 + 12 + i * 4;
      ctx.lineTo(xx, yy + 3);
    }
    ctx.stroke();
    // 정전기 스파크
    drawStaticSparks();
    // 머리
    const head = ctx.createRadialGradient(-R * 0.3, -R * 0.3, R * 0.2, 0, 0, R * 1.15);
    head.addColorStop(0, '#5a6d94');
    head.addColorStop(1, '#3d4d6b');
    ctx.fillStyle = head;
    ctx.beginPath(); ctx.ellipse(0, 0, R * 1.15, R * 0.85, 0, 0, 6.28); ctx.fill();
    // 번개 왕관 (자칭 왕의 위엄)
    ctx.fillStyle = '#ffd76e';
    ctx.beginPath();
    ctx.moveTo(-R * 0.35, -R * 0.75);
    ctx.lineTo(-R * 0.15, -R * 1.25);
    ctx.lineTo(-R * 0.02, -R * 0.9);
    ctx.lineTo(R * 0.18, -R * 1.35);
    ctx.lineTo(R * 0.22, -R * 0.85);
    ctx.lineTo(R * 0.4, -R * 0.72);
    ctx.closePath();
    ctx.fill();
    // 눈 (의기양양)
    ctx.fillStyle = '#fff';
    ctx.beginPath(); ctx.arc(-R * 0.4, -R * 0.15, R * 0.18, 0, 6.28); ctx.fill();
    ctx.fillStyle = '#26314a';
    ctx.beginPath(); ctx.arc(-R * 0.44, -R * 0.12, R * 0.08, 0, 6.28); ctx.fill();
    ctx.strokeStyle = '#26314a'; ctx.lineWidth = 2.5 * s;
    ctx.beginPath(); ctx.moveTo(-R * 0.65, -R * 0.42); ctx.lineTo(-R * 0.2, -R * 0.34); ctx.stroke();
    // 입 (으스대는 미소)
    ctx.beginPath(); ctx.arc(-R * 0.5, R * 0.18, R * 0.28, -0.4, Math.PI * 0.55); ctx.stroke();
    ctx.restore();
  }

  drawHpBar(ctx) {
    if (this.phase === 0 || this.dead) return;
    const beads = 20;
    const w = 400, x0 = (CFG.W - w) / 2, y = 26;
    const alive = Math.ceil(this.hpRatio() * beads);
    ctx.save();
    ctx.strokeStyle = 'rgba(255,255,255,0.25)'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(x0, y); ctx.lineTo(x0 + w, y); ctx.stroke();
    for (let i = 0; i < beads; i++) {
      const bx = x0 + (i + 0.5) * (w / beads);
      if (i < alive) {
        const g = ctx.createRadialGradient(bx - 2, y - 2, 0, bx, y, 7);
        g.addColorStop(0, '#fff'); g.addColorStop(1, '#ffd76e');
        ctx.fillStyle = g;
        ctx.beginPath(); ctx.arc(bx, y, 7, 0, 6.28); ctx.fill();
      } else {
        ctx.strokeStyle = 'rgba(255,255,255,0.3)'; ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.arc(bx, y, 5, 0, 6.28); ctx.stroke();
      }
    }
    ctx.fillStyle = '#ffe9a8'; ctx.font = Fonts.f(13); ctx.textAlign = 'center';
    ctx.fillText('천둥 뱀장어 「우르릉」', CFG.W / 2, 50);
    ctx.restore();
  }
}
