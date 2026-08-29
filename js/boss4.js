// ============================================================
// boss4.js — 보스 4호: 심해 아귀 「초롱」 (심해 협곡, GDD 9.7)
// P1 어둠 속 낚시 → P2 불 켜기 → P3 대파도 「심해의 별밤」
// 규칙: 초롱불(광원)이 곧 예고 — 빠르게 깜빡이면 돌진이 온다.
//       P3의 별탄은 스스로 빛나는 유일한 광원 — 별자리 사이를 유영.
// 톤: 덩치 크고 이빨 무섭게 생겼는데 소심하고 수줍은 겁쟁이.
// ============================================================
const BOSS4_PATTERNS = {
  1: { id: 'chorong-dark-fishing', name: '어둠 낚시' },
  2: { id: 'chorong-light-rings',  name: '불 켜기 링' },
  3: { id: 'chorong-deep-stars',   name: '심해의 별밤' },  // 대파도
  4: { id: 'chorong-falling-stars', name: '진·심해의 별밤' },  // 하드 전용: 별똥별
};

class BossChorong {
  constructor(game) {
    this.game = game;
    this.hp = CFG.boss4Hp;
    this.maxHp = CFG.boss4Hp;
    this.x = CFG.W + 100;
    this.y = CFG.H * 0.5;
    this.t = 0;
    this.anim = 0;
    this.phase = 0;
    this.scale = 1.15;
    this.telegraph = 0;
    this.mode = 'drift';      // drift | blink(돌진 예고) | lunge | return
    this.modeT = 2.4;
    this.lungeVx = 0; this.lungeVy = 0;
    this.aimT = 1.4;
    this.ringT = 2.0;
    this.ringCount = 0;
    this.minionT = 5;
    this.starT = 0.3;
    this.lungeCycleT = 5.0;
    this.transitionT = 0;
    this.dead = false;
    this.deathT = 0;
    // 초롱불 (광원이자 예고등)
    this.lureX = this.x; this.lureY = this.y; this.lureR = 150;
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
    this.mode = 'drift';
    this.modeT = 2.4;
    this.game.clearBulletsToPearls(false);
    if (p === 2) {
      this.game.message('"부, 불 켜줄게! 놀라지 마!"', '#7ee8e0');
      this.game.targetDark = 0.7;   // 조금 밝아짐
      this.game.addBattery(1);
      this.game.phaseReward(this.x, this.y);
    } else if (p === 3) {
      this.game.message('"별... 예쁘지? 나만 아는 곳이야."', '#aef7ee');
      this.game.targetDark = 0.94;  // 가장 깊은 어둠 — 별만 빛난다
      this.game.addBattery(1);
      this.game.phaseReward(this.x, this.y);
    } else if (p === 4) {
      // 진 대파도: 별똥별 — 별자리가 무너져 내린다 (본인도 당황)
      this.game.message('"어, 어어?! 별이... 떨어진다?!"', '#d8fff8');
      this.game.addBattery(1);
      this.game.phaseReward(this.x, this.y);
    }
  }

  die() {
    this.dead = true;
    this.deathT = 0;
    Sound.sfx('bossDeath');
    this.game.targetDark = 0;       // 어둠이 걷힌다
    this.game.clearBulletsToPearls(true);
    for (let i = 0; i < 46; i++) {
      const a = Math.random() * 6.28, s = 60 + Math.random() * 240;
      this.game.pearls.push(new Pearl(this.x, this.y, { vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: 15, auto: true }));
    }
    for (let i = 0; i < 4; i++) {
      const a = Math.random() * 6.28;
      this.game.pearls.push(new Pearl(this.x, this.y, { vx: Math.cos(a) * 130, vy: Math.sin(a) * 130, big: true, life: 15, auto: true }));
    }
    this.game.message('"...벌써 가? 그, 그럼 초롱불 하나 줄게. 조심히 가..."', '#a8ffcf');
  }

  update(dt) {
    this.t += dt; this.anim += dt;
    const g = this.game;

    // 초롱불 위치. 완성 스프라이트 안에 그려진 흰 전구와 광원·탄 원점을 맞춘다.
    const s = this.scale;
    this.lureX = this.x - 50 * s;
    this.lureY = this.y - 40 * s;

    if (this.dead) {
      this.deathT += dt;
      this.y += 25 * dt; // 수줍게 가라앉으며 퇴장
      this.lureR = 150 + this.deathT * 300; // 초롱불이 크게 번지며 작별 인사
      if (this.deathT > 2.6) g.victory();
      return;
    }

    if (this.phase === 0) {
      this.x -= 70 * dt;
      if (this.x <= CFG.W * 0.8) {
        this.x = CFG.W * 0.8;
        this.phase = 1;
        g.message('심해 아귀 「초롱」', '#7ee8e0');
        g.message('"어... 어라. 우리 집에 손님은 처음인데..."', '#aef7ee');
      }
      return;
    }

    if (this.transitionT > 0) { this.transitionT -= dt; return; }

    const m = this.mercy();
    if (this.telegraph > 0) this.telegraph -= dt;

    // ---- 돌진 사이클 (P1·P3 공용): 초롱불 깜빡임이 곧 예고 ----
    const doLungeCycle = (interval) => {
      if (this.mode === 'drift') {
        this.lungeCycleT -= dt;
        if (this.lungeCycleT <= 0) {
          this.mode = 'blink';
          this.modeT = 0.85;
          if (g.dolphin && this.telegraph <= 0) this.telegraph = 0.85; // 힌트 겹침
        }
      } else if (this.mode === 'blink') {
        this.modeT -= dt;
        if (this.modeT <= 0) {
          // 플레이어 위치 스냅샷 방향으로 물기 돌진
          const a = Math.atan2(g.player.y - this.y, g.player.x - this.x);
          this.lungeVx = Math.cos(a) * 640;
          this.lungeVy = Math.sin(a) * 640;
          this.mode = 'lunge';
          this.modeT = 0.6;
        }
      } else if (this.mode === 'lunge') {
        this.x += this.lungeVx * dt;
        this.y += this.lungeVy * dt;
        this.modeT -= dt;
        if (this.modeT <= 0) { this.mode = 'return'; }
      } else if (this.mode === 'return') {
        this.x += (CFG.W * 0.8 - this.x) * Math.min(1, dt * 1.8);
        this.y += (CFG.H * 0.5 - this.y) * Math.min(1, dt * 1.2);
        if (Math.abs(this.x - CFG.W * 0.8) < 30) {
          this.mode = 'drift';
          this.lungeCycleT = interval * m;
        }
      }
    };

    if (this.phase === 1) {
      // P1: 어둠 낚시 — 떠다니며 조준탄, 초롱 깜빡이면 물기 돌진
      if (this.mode === 'drift') {
        this.x += (CFG.W * 0.8 - this.x) * Math.min(1, dt * 2);
        this.y = CFG.H * 0.5 + Math.sin(this.anim * 0.7) * 120;
        this.aimT -= dt;
        if (this.aimT <= 0) {
          this.aimT = 2.3 * m;
          g.bossAimed(this.lureX, this.lureY, 140, 2, 0.35);
        }
      }
      doLungeCycle(4.6);
    } else if (this.phase === 2) {
      // P2: 불 켜기 — 몸 드러내고 링 + 등불 해파리 소환 (플레이어의 광원이 되어줌)
      this.x += (CFG.W * 0.8 - this.x) * Math.min(1, dt * 2);
      this.y = CFG.H * 0.5 + Math.sin(this.anim * 0.8) * 140;
      this.ringT -= dt;
      if (g.dolphin && this.ringT <= 0.5 && this.ringT > 0 && this.telegraph <= 0) this.telegraph = 0.5;
      if (this.ringT <= 0) {
        this.ringT = 2.6 * m;
        this.ringCount++;
        if (this.ringCount % 3 === 0) {
          g.bossAimed(this.lureX, this.lureY, 150, 3, 0.24);
        } else {
          g.bossRing(this.x, this.y, 18, 105, Math.random() * 6.28);
        }
      }
      this.minionT -= dt;
      if (this.minionT <= 0) {
        this.minionT = 10 * m;
        g.spawner.pending.push({ at: g.stageT, spec: {
          kind: 'lantern', M: 2, S: 0, hp: 5, spd: 50, amp: 30, freq: 1.2,
          x: CFG.W + 30, y: (0.25 + Math.random() * 0.5) * CFG.H,
          dirX: -1, dirY: 0, groupId: -1, phase: 0,
        }});
      }
    } else if (this.phase >= 3) {
      // P3 대파도: 심해의 별밤 — 스스로 빛나는 별탄이 어둠을 채운다
      // 진 대파도(P4): 별똥별 — 활성 별이 플레이어 쪽으로 완만히 미끄러진다
      if (this.phase === 4) {
        this.fallT = (this.fallT ?? 2.0) - dt;
        if (this.fallT <= 0) {
          this.fallT = 2.4 * m;
          if (g.dolphin && this.telegraph <= 0) this.telegraph = 0.6;
          const px = g.player.x, py = g.player.y;
          const actives = g.ebullets.filter(b => b.kind === 'star' && (!b.armT || b.armT <= 0));
          for (let i = 0; i < Math.min(6, actives.length); i++) {
            const b = actives[Math.floor(Math.random() * actives.length)];
            const d = Math.hypot(px - b.x, py - b.y) || 1;
            b.fallTo = { vx: (px - b.x) / d * 130, vy: (py - b.y) / d * 130 };
          }
        }
      }
      if (this.mode === 'drift') {
        this.x += (CFG.W * 0.82 - this.x) * Math.min(1, dt * 2);
        this.y = CFG.H * 0.5 + Math.sin(this.anim * 0.6) * 100;
      }
      this.starT -= dt;
      if (this.starT <= 0) {
        this.starT = 0.24 * m;
        // 별탄 상한 — 화면이 별로 가득 차되 막히지는 않게
        const stars = g.ebullets.filter(b => b.kind === 'star').length;
        if (stars < 55 + g.diff * 10) { // 난이도: 별밤 밀도
          // 별은 화면 전역에서 "태어난다" — 초롱 주변만 위험하면 원거리가 안전해지므로.
          // armT 동안은 반짝이며 무해(예고), 이후 활성. 플레이어 바로 위엔 안 태어남.
          const sx = Math.random() * CFG.W * 0.85;
          const sy = Math.random() * CFG.H;
          if (Math.hypot(sx - g.player.x, sy - g.player.y) > 110) {
            const a = Math.random() * 6.28;
            const spd = 22 + Math.random() * 26;
            g.ebullets.push({
              x: sx, y: sy,
              vx: Math.cos(a) * spd, vy: Math.sin(a) * spd,
              r: 5, kind: 'star', armT: 0.7,
            });
          }
        }
      }
      doLungeCycle(5.4);
    }
  }

  draw(ctx) {
    ctx.save();
    ctx.translate(this.x, this.y);
    const s = this.scale;
    const R = 46 * s;
    const lunging = this.mode === 'lunge';
    if (this.dead) ctx.globalAlpha = Math.max(0, 1 - this.deathT / 2.6);

    // 힌트 예고 반짝 (돌고래)
    if (this.telegraph > 0) {
      ctx.strokeStyle = `rgba(255, 240, 150, ${Math.min(1, this.telegraph)})`;
      ctx.lineWidth = 3;
      ctx.beginPath(); ctx.arc(0, 0, R + 18, 0, 6.28); ctx.stroke();
    }

    // 본체만 스프라이트로 교체한다. 초롱 줄기·광원·예고는 코드 연출을 유지한다.
    const spriteBodyDrawn = Sprites.draw(ctx, 'boss.chorong', 0, 0, { t: this.anim, scale: s });
    if (!spriteBodyDrawn) {
    // 몸통 (어두운 심해색 — 어둠 속에선 실루엣만)
    const body = ctx.createRadialGradient(-R * 0.2, -R * 0.25, R * 0.2, 0, 0, R);
    body.addColorStop(0, '#31406b');
    body.addColorStop(1, '#1c2747');
    ctx.fillStyle = body;
    ctx.beginPath();
    ctx.ellipse(0, 0, R, R * 0.82, 0, 0, 6.28);
    ctx.fill();
    // 꼬리
    ctx.fillStyle = '#243155';
    const wag = Math.sin(this.anim * 3) * 6;
    ctx.beginPath();
    ctx.moveTo(R * 0.85, 0);
    ctx.lineTo(R * 1.3, -R * 0.3 + wag);
    ctx.lineTo(R * 1.3, R * 0.3 + wag);
    ctx.fill();
    // 입 (돌진 중엔 쩍 벌어짐) + 지그재그 이빨
    const jaw = lunging ? R * 0.5 : R * 0.16 + Math.sin(this.anim * 1.8) * 2;
    ctx.fillStyle = '#101830';
    ctx.beginPath();
    ctx.moveTo(-R * 0.95, -jaw * 0.35);
    ctx.quadraticCurveTo(-R * 0.35, -jaw * 0.1, -R * 0.15, -jaw * 0.4);
    ctx.lineTo(-R * 0.15, jaw * 0.55);
    ctx.quadraticCurveTo(-R * 0.55, jaw * 0.75, -R * 0.95, jaw * 0.4);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.9)'; ctx.lineWidth = 1.6;
    ctx.beginPath();
    for (let i = 0; i < 6; i++) {
      const tx = -R * 0.9 + i * R * 0.13;
      ctx.moveTo(tx, -jaw * 0.3 + (i % 2) * 3);
      ctx.lineTo(tx + R * 0.06, -jaw * 0.3 + 6 + (i % 2) * 3);
    }
    for (let i = 0; i < 6; i++) {
      const tx = -R * 0.88 + i * R * 0.13;
      ctx.moveTo(tx, jaw * 0.45 - (i % 2) * 3);
      ctx.lineTo(tx + R * 0.06, jaw * 0.45 - 7 - (i % 2) * 3);
    }
    ctx.stroke();
    // 겁먹은 동그란 눈
    ctx.fillStyle = '#fff';
    ctx.beginPath(); ctx.arc(-R * 0.35, -R * 0.42, R * 0.14, 0, 6.28); ctx.fill();
    ctx.fillStyle = '#333';
    const look = lunging ? -3 : Math.sin(this.anim * 0.9) * 2;
    ctx.beginPath(); ctx.arc(-R * 0.35 + look, -R * 0.42 + 2, R * 0.06, 0, 6.28); ctx.fill();
    // 볼터치 (수줍음)
    ctx.fillStyle = 'rgba(255,158,199,0.35)';
    ctx.beginPath(); ctx.arc(-R * 0.15, -R * 0.12, R * 0.1, 0, 6.28); ctx.fill();
    // 지느러미
    ctx.fillStyle = '#243155';
    ctx.beginPath();
    ctx.moveTo(R * 0.1, R * 0.7);
    ctx.lineTo(R * 0.35, R * 1.0 + wag * 0.4);
    ctx.lineTo(R * 0.5, R * 0.65);
    ctx.fill();
    }
    ctx.restore();

    // 생성 스프라이트에는 초롱 줄기와 전구가 이미 포함되어 있다.
    // 폴백 몸체에서만 기존 줄기를 그리고, 스프라이트일 때는 같은 전구 위치의 점멸만 덧댄다.
    ctx.save();
    const blinkFast = this.mode === 'blink' && Math.floor(this.modeT * 14) % 2 === 0;
    if (!spriteBodyDrawn) {
      ctx.strokeStyle = '#31406b'; ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(this.x - 20 * s, this.y - 34 * s);
      ctx.quadraticCurveTo(this.x - 50 * s, this.y - 62 * s, this.lureX, this.lureY + 8);
      ctx.stroke();
      const lure = ctx.createRadialGradient(this.lureX, this.lureY, 0, this.lureX, this.lureY, 18);
      lure.addColorStop(0, blinkFast ? '#ffffff' : '#d8fff8');
      lure.addColorStop(0.5, blinkFast ? '#ffd0d0' : '#8ef0e2');
      lure.addColorStop(1, 'rgba(126,232,224,0)');
      ctx.fillStyle = lure;
      ctx.beginPath(); ctx.arc(this.lureX, this.lureY, 18, 0, 6.28); ctx.fill();
    } else if (blinkFast) {
      ctx.fillStyle = '#ffd0d0';
      ctx.beginPath(); ctx.arc(this.lureX, this.lureY, 4, 0, 6.28); ctx.fill();
    }
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
        g.addColorStop(0, '#fff'); g.addColorStop(1, '#7ee8e0');
        ctx.fillStyle = g;
        ctx.beginPath(); ctx.arc(bx, y, 7, 0, 6.28); ctx.fill();
      } else {
        ctx.strokeStyle = 'rgba(255,255,255,0.3)'; ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.arc(bx, y, 5, 0, 6.28); ctx.stroke();
      }
    }
    ctx.fillStyle = '#aef7ee'; ctx.font = Fonts.f(13); ctx.textAlign = 'center';
    ctx.fillText('심해 아귀 「초롱」', CFG.W / 2, 50);
    ctx.restore();
  }
}
