// ============================================================
// boss2.js — 보스 2호: 등불 여왕 「몽실」 (해파리 초원, GDD 9.3)
// P1 촉수 커튼 → P2 등불 설치 → P3 대파도 「등불 정원」
// 규칙: P3에서 등불 줄이 위→중→아래 순서로 켜진다. 안 켜진 줄에 서면 안전.
// 톤: 화난 팡팡과 반대 — 몽롱하고 나른한 여왕님.
// ============================================================
const BOSS2_PATTERNS = {
  1: { id: 'mongsil-tentacle-curtain', name: '촉수 커튼' },
  2: { id: 'mongsil-lantern-lay',      name: '등불 설치' },
  3: { id: 'mongsil-lantern-garden',   name: '등불 정원' },  // 대파도
  4: { id: 'mongsil-true-garden',      name: '진·등불 정원' },  // 하드 전용: 두 줄 동시 점등
};

class BossMongsil {
  constructor(game) {
    this.game = game;
    this.hp = CFG.boss2Hp;
    this.maxHp = CFG.boss2Hp;
    this.x = CFG.W + 90;
    this.y = CFG.H * 0.5;
    this.t = 0;
    this.anim = 0;
    this.phase = 0;
    this.scale = 1;
    this.targetScale = 1;
    this.telegraph = 0;
    this.curtainT = 2.5;      // P1 커튼 주기
    this.curtainCount = 0;
    this.mineT = 1.5;         // P2 설치 주기
    this.rainT = 0;
    this.gardenT = 2.0;       // P3 정원 줄 주기
    this.gardenRow = 0;       // 다음에 켤 줄 (0=위, 1=중, 2=아래)
    this.minionT = 6;
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
    this.game.clearBulletsToPearls(false);
    if (p === 2) {
      this.targetScale = 1.15;
      this.game.message('"등불 켤 시간이야~ 몽글몽글"', '#ffd66e');
      this.game.addBattery(1);
      this.game.phaseReward(this.x, this.y);
    } else if (p === 3) {
      this.targetScale = 1.3;
      this.game.message('"정원 가득 반짝반짝... 예쁘지?"', '#c9a3ff');
      this.game.addBattery(1);
      this.game.phaseReward(this.x, this.y);
    } else if (p === 4) {
      // 진 대파도: 두 줄 동시 점등 — 안전한 줄이 하나뿐
      this.targetScale = 1.42;
      this.game.message('"...정원의 진짜 모습, 보여줄게."', '#e2ccff');
      this.game.addBattery(1);
      this.game.phaseReward(this.x, this.y);
    }
  }

  die() {
    this.dead = true;
    this.deathT = 0;
    Sound.sfx('bossDeath');
    this.game.clearBulletsToPearls(true);
    for (let i = 0; i < 40; i++) {
      const a = Math.random() * 6.28, s = 60 + Math.random() * 220;
      this.game.pearls.push(new Pearl(this.x, this.y, { vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: 15, auto: true }));
    }
    for (let i = 0; i < 4; i++) {
      const a = Math.random() * 6.28;
      this.game.pearls.push(new Pearl(this.x, this.y, { vx: Math.cos(a) * 120, vy: Math.sin(a) * 120, big: true, life: 15, auto: true }));
    }
    this.game.message('"...집? 그래. 등불 하나 들고, 조심히 가~"', '#a8ffcf');
  }

  update(dt) {
    this.t += dt; this.anim += dt;
    const g = this.game;
    this.scale += (this.targetScale - this.scale) * Math.min(1, dt * 3);

    if (this.dead) {
      this.deathT += dt;
      // 스르르 위로 떠오르며 흐려짐 (해파리답게)
      this.y -= 30 * dt;
      this.scale = Math.max(0.4, this.scale - dt * 0.35);
      if (this.deathT > 2.6) g.victory();
      return;
    }

    // 등장
    if (this.phase === 0) {
      this.x -= 80 * dt;
      if (this.x <= CFG.W * 0.8) {
        this.x = CFG.W * 0.8;
        this.phase = 1;
        g.message('등불 여왕 「몽실」', '#c9a3ff');
        g.message('"어머... 우리 초원에 손님이네?"', '#ffd66e');
      }
      return;
    }

    if (this.transitionT > 0) { this.transitionT -= dt; return; }

    // 수직 유영 (해파리는 세로로 넓게 떠다닌다)
    const amp = this.phase === 3 ? 60 : this.phase === 2 ? 170 : 140;
    this.y = CFG.H * 0.5 + Math.sin(this.anim * 0.55) * amp;

    const m = this.mercy();
    if (this.telegraph > 0) this.telegraph -= dt;

    if (this.phase === 1) {
      // P1: 촉수 커튼 — 위에서 전폭 낙하 (틈 2칸), 2회마다 조준 단발
      this.curtainT -= dt;
      if (g.dolphin && this.curtainT <= 0.5 && this.curtainT > 0 && this.telegraph <= 0) this.telegraph = 0.5;
      if (this.curtainT <= 0) {
        this.curtainT = 3.4 * m;
        this.curtainCount++;
        this.spawnCurtain(g, 10 + g.diff); // 난이도: 커튼 밀도 (틈은 2칸 유지)
        if (this.curtainCount % 2 === 0) g.bossAimed(this.x - 20, this.y, 140, 1, 0);
      }
      // 진주 셔틀
      this.minionT -= dt;
      if (this.minionT <= 0) {
        this.minionT = 8;
        const y = (0.2 + Math.random() * 0.6) * CFG.H;
        for (let i = 0; i < 3; i++) {
          g.spawner.pending.push({ at: g.stageT + i * 0.35, spec: {
            kind: 'fish', M: 2, S: 0, hp: 1, spd: 130, amp: 30, freq: 3,
            x: CFG.W + 30, y, dirX: -1, dirY: 0, groupId: -1, phase: 0,
          }});
        }
      }
    } else if (this.phase === 2) {
      // P2: 등불 기뢰 2개씩 설치 + 가벼운 낙하 비
      this.mineT -= dt;
      if (g.dolphin && this.mineT <= 0.5 && this.mineT > 0 && this.telegraph <= 0) this.telegraph = 0.5;
      if (this.mineT <= 0) {
        this.mineT = 2.4 * m;
        for (let i = 0; i < 2 + (g.diff >= 2 ? 1 : 0); i++) {
          g.ebullets.push({
            x: (0.15 + Math.random() * 0.45) * CFG.W,
            y: (0.2 + Math.random() * 0.6) * CFG.H,
            vx: 0, vy: 8, r: 7, kind: 'mine', timer: CFG.mineTimer,
          });
        }
      }
      this.rainT -= dt;
      if (this.rainT <= 0) {
        this.rainT = 0.55 * m;
        g.ebullets.push({ x: Math.random() * CFG.W * 0.75, y: -10, vx: -10, vy: 85, r: CFG.ebR, kind: 'bubble' });
      }
    } else if (this.phase >= 3) {
      // P3 대파도: 등불 정원 — 줄 단위로 등불이 켜지고 터진다 (위→중→아래 순환)
      // 순서를 읽고 안 켜진 줄로 이동하면 안전. 진 대파도(P4): 두 줄 동시 — 남는 줄은 하나
      this.gardenT -= dt;
      if (g.dolphin && this.gardenT <= 0.6 && this.gardenT > 0 && this.telegraph <= 0) this.telegraph = 0.6;
      if (this.gardenT <= 0) {
        this.gardenT = (this.phase === 4 ? 3.0 : 2.6) * m;
        const rowsToLight = this.phase === 4 ? 2 : 1;
        const gn = 5 + g.diff; // 난이도: 정원 등불 밀도
        for (let rr = 0; rr < rowsToLight; rr++) {
          const rowY = [0.22, 0.5, 0.78][this.gardenRow] * CFG.H;
          this.gardenRow = (this.gardenRow + 1) % 3;
          for (let i = 0; i < gn; i++) {
            g.ebullets.push({
              x: 60 + i * (CFG.W * 0.68 / (gn - 1)),
              y: rowY + (Math.random() - 0.5) * 20,
              vx: 0, vy: 0, r: 7, kind: 'mine', timer: 1.4,
            });
          }
        }
      }
      // 느린 커튼도 계속
      this.curtainT -= dt;
      if (this.curtainT <= 0) {
        this.curtainT = 5.2 * m;
        this.spawnCurtain(g, 8 + g.diff, 75);
      }
    }
  }

  spawnCurtain(g, n, spd = 100) {
    const gapIdx = 1 + Math.floor(Math.random() * (n - 2));
    const spacing = (CFG.W * 0.78) / n;
    for (let i = 0; i <= n; i++) {
      if (i === gapIdx || i === gapIdx + 1) continue;
      g.ebullets.push({ x: 30 + i * spacing, y: -10, vx: 0, vy: spd, r: CFG.ebR, kind: 'bubble' });
    }
  }

  draw(ctx) {
    ctx.save();
    ctx.translate(this.x, this.y);
    const s = this.scale;
    const R = 38 * s;
    const alpha = this.dead ? Math.max(0, 1 - this.deathT / 2.6) : 1;
    ctx.globalAlpha = alpha;
    const sway = Math.sin(this.anim * 1.6) * 3;

    // 등불 광채 (페이즈 오를수록 밝게)
    const glowR = R * (1.6 + this.phase * 0.25);
    const glow = ctx.createRadialGradient(0, 0, 0, 0, 0, glowR);
    glow.addColorStop(0, `rgba(255,214,110,${0.28 + this.phase * 0.06})`);
    glow.addColorStop(1, 'rgba(255,214,110,0)');
    ctx.fillStyle = glow;
    ctx.beginPath(); ctx.arc(0, 0, glowR, 0, 6.28); ctx.fill();

    // 예고 반짝
    if (this.telegraph > 0) {
      ctx.strokeStyle = `rgba(255, 240, 150, ${this.telegraph})`;
      ctx.lineWidth = 3;
      ctx.beginPath(); ctx.arc(0, 0, R + 16, 0, 6.28); ctx.stroke();
    }

    // 본체만 스프라이트로 교체하고 광채·예고·페이즈 확대는 기존 보스 로직을 유지한다.
    if (Sprites.draw(ctx, 'boss.mongsil', 0, 0, { t: this.anim, scale: s })) {
      ctx.restore();
      return;
    }

    // 촉수 (길고 하늘하늘)
    ctx.strokeStyle = 'rgba(226,204,255,0.8)'; ctx.lineWidth = 2.5;
    for (let i = -2; i <= 2; i++) {
      ctx.beginPath();
      ctx.moveTo(i * R * 0.3, R * 0.3);
      ctx.quadraticCurveTo(
        i * R * 0.3 + Math.sin(this.anim * 2.2 + i) * 12, R * 0.9,
        i * R * 0.3 + Math.sin(this.anim * 2.2 + i + 1.5) * 16, R * 1.6,
      );
      ctx.stroke();
    }

    // 갓 (보라-분홍 반투명)
    const bell = ctx.createRadialGradient(-R * 0.25, -R * 0.3, R * 0.2, 0, 0, R);
    bell.addColorStop(0, 'rgba(240,220,255,0.95)');
    bell.addColorStop(1, 'rgba(180,140,230,0.85)');
    ctx.fillStyle = bell;
    ctx.beginPath();
    ctx.arc(sway, 0, R, Math.PI, 0);
    ctx.quadraticCurveTo(R * 0.8 + sway, R * 0.35, R * 0.55 + sway, R * 0.3);
    ctx.quadraticCurveTo(0 + sway, R * 0.55, -R * 0.55 + sway, R * 0.3);
    ctx.quadraticCurveTo(-R * 0.8 + sway, R * 0.35, -R + sway, 0);
    ctx.fill();

    // 왕관
    ctx.fillStyle = '#ffd66e';
    ctx.beginPath();
    ctx.moveTo(-R * 0.3 + sway, -R * 0.92);
    ctx.lineTo(-R * 0.2 + sway, -R * 1.18);
    ctx.lineTo(-R * 0.08 + sway, -R * 0.98);
    ctx.lineTo(sway, -R * 1.25);
    ctx.lineTo(R * 0.08 + sway, -R * 0.98);
    ctx.lineTo(R * 0.2 + sway, -R * 1.18);
    ctx.lineTo(R * 0.3 + sway, -R * 0.92);
    ctx.fill();

    // 몸속 등불
    ctx.fillStyle = 'rgba(255,214,110,0.9)';
    ctx.beginPath(); ctx.arc(sway, -R * 0.25, R * 0.18, 0, 6.28); ctx.fill();

    // 눈 (나른한 반달)
    ctx.strokeStyle = '#5c4a7a'; ctx.lineWidth = 2.5 * s;
    if (this.dead) {
      ctx.font = Fonts.f(9 * s); ctx.textAlign = 'center';
      ctx.fillStyle = '#5c4a7a';
      ctx.fillText('u   u', sway, -R * 0.35);
    } else {
      ctx.beginPath(); ctx.arc(-R * 0.28 + sway, -R * 0.38, R * 0.12, 0.15, Math.PI - 0.15); ctx.stroke();
      ctx.beginPath(); ctx.arc(R * 0.28 + sway, -R * 0.38, R * 0.12, 0.15, Math.PI - 0.15); ctx.stroke();
    }
    // 볼터치
    ctx.fillStyle = 'rgba(255,158,199,0.5)';
    ctx.beginPath(); ctx.arc(-R * 0.45 + sway, -R * 0.2, R * 0.1, 0, 6.28); ctx.fill();
    ctx.beginPath(); ctx.arc(R * 0.45 + sway, -R * 0.2, R * 0.1, 0, 6.28); ctx.fill();

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
        g.addColorStop(0, '#fff'); g.addColorStop(1, '#c9a3ff');
        ctx.fillStyle = g;
        ctx.beginPath(); ctx.arc(bx, y, 7, 0, 6.28); ctx.fill();
      } else {
        ctx.strokeStyle = 'rgba(255,255,255,0.3)'; ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.arc(bx, y, 5, 0, 6.28); ctx.stroke();
      }
    }
    ctx.fillStyle = '#e2ccff'; ctx.font = Fonts.f(13); ctx.textAlign = 'center';
    ctx.fillText('등불 여왕 「몽실」', CFG.W / 2, 50);
    ctx.restore();
  }
}
