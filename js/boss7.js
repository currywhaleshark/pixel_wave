// ============================================================
// boss7.js — 라스보스: 폭풍의 근원 「휘이」 (용궁 앞바다, GDD 9.10)
// P1 소용돌이(흡인) → P2 돌풍(밀당) → P3 대파도 「태풍의 눈」
// 규칙의 역설: P3에선 태풍의 눈(보스 근처)만이 안전하다.
//   폭풍은 밀어내지만, 다가가야 끝난다 — 외로움에게 다가가 주는 것.
// 톤: 외로운 폭풍. 모두가 피해 가는 존재.
// ============================================================
const BOSS7_PATTERNS = {
  1: { id: 'hwii-maelstrom',    name: '소용돌이' },
  2: { id: 'hwii-gale',         name: '돌풍 밀당' },
  3: { id: 'hwii-eye-of-storm', name: '태풍의 눈' },  // 대파도
  4: { id: 'hwii-wandering-eye', name: '진·태풍의 눈' },  // 하드 전용: 눈이 움직인다
};

class BossHwii {
  constructor(game) {
    this.game = game;
    this.hp = CFG.boss7Hp;
    this.maxHp = CFG.boss7Hp;
    this.x = CFG.W + 150;
    this.y = CFG.H * 0.5;
    this.t = 0;
    this.anim = 0;
    this.phase = 0;
    this.scale = 1.2;
    this.telegraph = 0;
    this.spiralAngle = 0;
    this.spiralT = 0;
    this.gustT = 3.0;
    this.gustDir = 1;
    this.gustHold = 0;
    this.ringT = 2.5;
    this.boltT = 4.0;
    this.stormBulletT = 0;
    this.transitionT = 0;
    this.eyeLookX = 0;
    this.eyeLookY = 0;
    this.dead = false;
    this.deathT = 0;
  }

  hpRatio() { return Math.max(0, this.hp / this.maxHp); }

  mercy() {
    const over = this.t - CFG.bossMercyTime * 1.2; // 라스보스는 자비도 조금 늦게
    return (over > 0 ? 1 + Math.min(1.0, over / 50) : 1) * (this.game.D?.bossInt ?? 1);
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
    this.transitionT = 1.4;
    this.game.clearBulletsToPearls(false);
    if (p === 2) {
      this.game.message('"바람도, 파도도, 전부 나를 지나쳐 가!"', '#b8d8f0');
      this.game.addBattery(1);
      this.game.phaseReward(this.x, this.y);
    } else if (p === 3) {
      this.game.message('"...오지 마. 가까이 오면... 다 망가진단 말이야."', '#d8e8f8');
      this.game.message('(...태풍의 눈 속은 고요하다)', '#ffe9a8');
      this.game.addBattery(1);
      this.game.phaseReward(this.x, this.y);
    } else if (p === 4) {
      // 진 대파도: 눈이 움직인다 — 안전지대가 궤도를 돈다
      this.game.message('"...눈이, 움직여. 나도, 어쩔 수 없어...!"', '#eef6ff');
      this.game.addBattery(1);
      this.game.phaseReward(this.x, this.y);
    }
  }

  die() {
    this.dead = true;
    this.deathT = 0;
    Sound.sfx('bossDeath');
    this.game.stormScale = 0;   // 폭풍이 걷힌다
    this.game.bolts = [];
    this.game.clearBulletsToPearls(true);
    for (let i = 0; i < 60; i++) {
      const a = Math.random() * 6.28, s = 60 + Math.random() * 280;
      this.game.pearls.push(new Pearl(this.x, this.y, { vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: 15, auto: true }));
    }
    for (let i = 0; i < 6; i++) {
      const a = Math.random() * 6.28;
      this.game.pearls.push(new Pearl(this.x, this.y, { vx: Math.cos(a) * 140, vy: Math.sin(a) * 140, big: true, life: 15, auto: true }));
    }
    this.game.message('"...눈 속은, 이렇게 조용했구나."', '#d8e8f8');
    this.game.message('"...집, 데려다줄게. 같이 가."', '#a8ffcf');
  }

  update(dt) {
    this.t += dt; this.anim += dt;
    const g = this.game;
    const gazeTarget = g.player;
    if (gazeTarget) {
      const eyeDx = gazeTarget.x - this.x;
      const eyeDy = gazeTarget.y - this.y;
      const eyeDistance = Math.hypot(eyeDx, eyeDy) || 1;
      const targetLookX = this.dead ? 0 : eyeDx / eyeDistance * 6;
      const targetLookY = this.dead ? 2 : eyeDy / eyeDistance * 4.5;
      const follow = Math.min(1, dt * 9);
      this.eyeLookX += (targetLookX - this.eyeLookX) * follow;
      this.eyeLookY += (targetLookY - this.eyeLookY) * follow;
    }
    this.spiralAngle += 1.1 * dt;

    if (this.dead) {
      this.deathT += dt;
      this.scale = Math.max(0.2, this.scale - dt * 0.28); // 소용돌이가 풀린다
      if (this.deathT > 3.4) g.startEnding();
      return;
    }

    if (this.phase === 0) {
      this.x -= 70 * dt;
      if (this.x <= CFG.W * 0.7) {
        this.x = CFG.W * 0.7;
        this.phase = 1;
        g.message('폭풍의 근원 「휘이」', '#b8d8f0');
        g.message('"...돌아가. 다들 그랬듯이."', '#d8e8f8');
      }
      return;
    }

    if (this.transitionT > 0) { this.transitionT -= dt; return; }

    const m = this.mercy();
    if (this.telegraph > 0) this.telegraph -= dt;
    const pl = g.player;

    if (this.phase === 1) {
      // P1: 소용돌이 — 나선탄 + 부드러운 흡인 (빨려들지 않게 헤엄쳐라)
      this.y = CFG.H * 0.5 + Math.sin(this.anim * 0.5) * 90;
      this.spiralT -= dt;
      if (this.spiralT <= 0) {
        this.spiralT = 0.2 * m;
        const arms = 3 + (g.diff >= 2 ? 1 : 0); // 하드: 나선 4줄기
        for (let k = 0; k < arms; k++) {
          const a = this.spiralAngle + k * (Math.PI * 2 / arms);
          g.ebullets.push({
            x: this.x + Math.cos(a) * 46, y: this.y + Math.sin(a) * 46,
            vx: Math.cos(a) * 92, vy: Math.sin(a) * 92,
            r: CFG.ebR, kind: 'bubble',
          });
        }
      }
      // 흡인: 해류를 보스 방향으로 덮어씀
      const dx = this.x - pl.x, dy = this.y - pl.y;
      const d = Math.hypot(dx, dy) || 1;
      g.curX = dx / d * 58; g.curY = dy / d * 58;
    } else if (this.phase === 2) {
      // P2: 돌풍 밀당 — 좌우 강풍이 번갈아 (해류 화살표가 예고) + 낙뢰 + 링
      this.y = CFG.H * 0.5 + Math.sin(this.anim * 0.7) * 120;
      this.gustT -= dt;
      if (this.gustT <= 0) {
        this.gustT = 3.8 * m;
        this.gustDir = -this.gustDir;
        if (g.dolphin && this.telegraph <= 0) this.telegraph = 0.6;
      }
      g.curX = this.gustDir * 110;
      g.curY = Math.sin(this.anim * 1.3) * 30;
      this.ringT -= dt;
      if (this.ringT <= 0) {
        this.ringT = 2.7 * m;
        g.bossRing(this.x, this.y, 18, 105, Math.random() * 6.28);
      }
      this.boltT -= dt;
      if (this.boltT <= 0) {
        this.boltT = 4.4 * m;
        const px = pl.x / CFG.W;
        g.bolts.push({ x: Math.max(0.06, Math.min(0.94, px)) * CFG.W, w: CFG.boltW, telT: CFG.boltTelT, strikeT: CFG.boltStrikeT, hitDone: false });
        g.bolts.push({ x: Math.max(0.06, Math.min(0.94, px + (Math.random() < 0.5 ? 0.16 : -0.16))) * CFG.W, w: CFG.boltW, telT: CFG.boltTelT + 0.3, strikeT: CFG.boltStrikeT, hitDone: false });
      }
    } else if (this.phase >= 3) {
      // P3 대파도: 태풍의 눈 — 화면 전체가 회전 폭풍, 보스 근처만 고요.
      // 바람은 밀어내지만(방출 해류), 다가가야 끝난다.
      // 진 대파도(P4): 눈이 큰 궤도를 천천히 돈다 — 안전지대와 함께 움직여라
      if (this.phase === 4) {
        this.orbitA = (this.orbitA ?? 0) + 0.22 * dt;
        this.x += (CFG.W * 0.5 + Math.cos(this.orbitA) * CFG.W * 0.16 - this.x) * Math.min(1, dt * 1.5);
        this.y += (CFG.H * 0.5 + Math.sin(this.orbitA) * CFG.H * 0.2 - this.y) * Math.min(1, dt * 1.5);
      } else {
        this.x += (CFG.W * 0.62 - this.x) * Math.min(1, dt * 0.8);
        this.y += (CFG.H * 0.5 - this.y) * Math.min(1, dt * 0.8);
      }
      // 방출 해류: 눈에서 밀어냄
      const dx = pl.x - this.x, dy = pl.y - this.y;
      const d = Math.hypot(dx, dy) || 1;
      const push = d < 320 ? 88 : 40;
      g.curX = dx / d * push; g.curY = dy / d * push;
      // 폭풍탄: 바깥에서 나선으로 감겨들다 눈 앞(반경 175)에서 멈춘다
      this.stormBulletT -= dt;
      if (this.stormBulletT <= 0) {
        this.stormBulletT = 0.1 * m;
        const count = g.ebullets.filter(b => b.kind === 'storm').length;
        if (count < 70 + g.diff * 8) { // 난이도: 폭풍 밀도
          g.ebullets.push({
            kind: 'storm', x: this.x, y: this.y,
            ang: Math.random() * 6.28,
            orbitR: 480 + Math.random() * 180,
            angV: (Math.random() < 0.5 ? 1 : -1) * (0.55 + Math.random() * 0.5),
            inSpd: 62 + Math.random() * 50,   // 유입 속도 제각각 — 흐름이 끊기지 않게
            vx: 0, vy: 0, r: CFG.ebR,
          });
        }
      }
    }
  }

  draw(ctx) {
    ctx.save();
    ctx.translate(this.x, this.y);
    const s = this.scale;
    if (this.dead) ctx.globalAlpha = Math.max(0, 1 - this.deathT / 3.4);

    // 힌트 예고 반짝
    if (this.telegraph > 0) {
      ctx.strokeStyle = `rgba(255, 240, 150, ${Math.min(1, this.telegraph)})`;
      ctx.lineWidth = 3;
      ctx.beginPath(); ctx.arc(0, 0, 80 * s, 0, 6.28); ctx.stroke();
    }

    // 소용돌이 팔: 한 개의 갈고리형 구름 팔을 120도 간격으로 재사용한다.
    // 팔마다 흐름 위상을 어긋나게 해 세 덩어리가 동시에 딱딱 뒤집히지 않게 한다.
    const hasArmSprite = Sprites.has('boss.hwiiArm');
    for (let arm = 0; arm < 3; arm++) {
      ctx.save();
      ctx.rotate(this.spiralAngle + arm * (Math.PI * 2 / 3));
      if (hasArmSprite) {
        const armFrame = Math.floor(this.anim * 4 + arm) % 2;
        Sprites.draw(ctx, 'boss.hwiiArm', 0, 0, { frame: armFrame, scale: s });
      } else {
        // 자산 로딩 전에는 기존 선형 팔로 폴백한다.
        ctx.strokeStyle = `rgba(184, 216, 240, ${0.5 - arm * 0.08})`;
        ctx.lineWidth = 16 * s;
        ctx.lineCap = 'round';
        ctx.beginPath();
        for (let i = 0; i <= 14; i++) {
          const a = i * 0.22;
          const r = (18 + i * 6.5) * s;
          const px = Math.cos(a) * r, py = Math.sin(a) * r;
          i === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py);
        }
        ctx.stroke();
      }
      ctx.restore();
    }

    const hasEyelidOverlay = Sprites.has('boss.hwii');
    if (hasEyelidOverlay) {
      // 눈알은 아래 레이어에서 플레이어를 계속 추적한다.
      const lookX = this.eyeLookX * s;
      const lookY = this.eyeLookY * s;
      ctx.fillStyle = '#f7f3df';
      ctx.beginPath(); ctx.ellipse(0, 0, 25 * s, 18 * s, 0, 0, 6.28); ctx.fill();
      ctx.fillStyle = '#789bc7';
      ctx.beginPath(); ctx.ellipse(lookX, lookY, 10 * s, 13 * s, 0, 0, 6.28); ctx.fill();
      ctx.fillStyle = '#17345d';
      ctx.beginPath(); ctx.ellipse(lookX, lookY, 5.5 * s, 10 * s, 0, 0, 6.28); ctx.fill();
      ctx.fillStyle = '#fff';
      ctx.beginPath(); ctx.arc(lookX - 2.5 * s, lookY - 3.5 * s, 2.2 * s, 0, 6.28); ctx.fill();

      // 열린 프레임은 오래 유지하고, 3.6초마다 눈꺼풀 세 컷만 한 번 재생한다.
      const blinkT = this.anim % 3.6;
      let blinkFrame = 0;
      if (blinkT >= 3.18 && blinkT < 3.26) blinkFrame = 1;
      else if (blinkT >= 3.26 && blinkT < 3.36) blinkFrame = 2;
      else if (blinkT >= 3.36 && blinkT < 3.44) blinkFrame = 3;
      Sprites.draw(ctx, 'boss.hwii', 0, 0, { frame: blinkFrame, scale: s });
    } else {
      // 자산 미로딩 폴백: 기존 코드 중심핵과 눈.
      const core = ctx.createRadialGradient(0, 0, 4, 0, 0, 40 * s);
      core.addColorStop(0, '#eef6ff');
      core.addColorStop(0.6, '#9dbede');
      core.addColorStop(1, 'rgba(157,190,222,0)');
      ctx.fillStyle = core;
      ctx.beginPath(); ctx.arc(0, 0, 40 * s, 0, 6.28); ctx.fill();
      ctx.fillStyle = '#fff';
      ctx.beginPath(); ctx.ellipse(0, 0, 16 * s, 19 * s, 0, 0, 6.28); ctx.fill();
      const lookX = this.eyeLookX * s;
      const lookY = this.eyeLookY * s;
      ctx.fillStyle = '#3a5a7a';
      ctx.beginPath(); ctx.arc(lookX, lookY, 7.5 * s, 0, 6.28); ctx.fill();
      ctx.fillStyle = '#fff';
      ctx.beginPath(); ctx.arc(lookX - 2 * s, lookY - 2.5 * s, 2.5 * s, 0, 6.28); ctx.fill();
    }
    // 눈물 한 방울 (P3부터)
    if (this.phase >= 3 || this.dead) {
      ctx.fillStyle = 'rgba(180,220,255,0.85)';
      ctx.beginPath(); ctx.ellipse(6 * s, 22 * s + Math.sin(this.anim * 2) * 2, 3.5, 5, 0, 0, 6.28); ctx.fill();
    }
    ctx.restore();
  }

  drawHpBar(ctx) {
    if (this.phase === 0 || this.dead) return;
    const beads = 24;   // 라스보스는 목걸이도 조금 길게
    const w = 460, x0 = (CFG.W - w) / 2, y = 26;
    const alive = Math.ceil(this.hpRatio() * beads);
    ctx.save();
    ctx.strokeStyle = 'rgba(255,255,255,0.25)'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(x0, y); ctx.lineTo(x0 + w, y); ctx.stroke();
    for (let i = 0; i < beads; i++) {
      const bx = x0 + (i + 0.5) * (w / beads);
      if (i < alive) {
        const g = ctx.createRadialGradient(bx - 2, y - 2, 0, bx, y, 7);
        g.addColorStop(0, '#fff'); g.addColorStop(1, '#b8d8f0');
        ctx.fillStyle = g;
        ctx.beginPath(); ctx.arc(bx, y, 7, 0, 6.28); ctx.fill();
      } else {
        ctx.strokeStyle = 'rgba(255,255,255,0.3)'; ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.arc(bx, y, 5, 0, 6.28); ctx.stroke();
      }
    }
    ctx.fillStyle = '#d8e8f8'; ctx.font = Fonts.f(13); ctx.textAlign = 'center';
    ctx.fillText('폭풍의 근원 「휘이」', CFG.W / 2, 50);
    ctx.restore();
  }
}
