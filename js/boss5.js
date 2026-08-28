// ============================================================
// boss5.js — 보스 5호: 유령 곰치 「부우」 (난파선 묘지, GDD 9.8)
// P1 숨바꼭질(구멍 두더지) → P2 여기저기 부우! → P3 대파도 「유령 대행진」
// 규칙: 구멍의 거품이 예고. P3에선 장신 몸통이 뱀처럼 화면을 휘저음 —
//       머리를 보면 몸이 지나갈 길이 보인다 (몸통은 머리의 궤적을 따라옴).
// 톤: 놀래키는 걸 좋아하는 능글맞은 장난꾸러기 유령.
// ============================================================
const BOSS5_PATTERNS = {
  1: { id: 'buu-hide-and-seek', name: '숨바꼭질' },
  2: { id: 'buu-boo-everywhere', name: '여기저기 부우' },
  3: { id: 'buu-ghost-parade',   name: '유령 대행진' },  // 대파도
  4: { id: 'buu-twin-parade',    name: '진·유령 대행진' },  // 하드 전용: 거울 분신
};

class BossBuu {
  constructor(game) {
    this.game = game;
    this.hp = CFG.boss5Hp;
    this.maxHp = CFG.boss5Hp;
    this.holes = [0.22, 0.44, 0.66, 0.85].map(f => f * CFG.H);
    this.holeX = CFG.W * 0.935;   // 구멍 위치 (선체 위)
    this.outX = CFG.W * 0.84;     // 완전히 나왔을 때 머리 위치
    this.emerge = 0;              // 0=구멍 속, 1=완전히 나옴 (미끄러져 나오는 연출)
    this.x = CFG.W + 200;      // 숨어 있을 땐 화면 밖 (표적 안 됨)
    this.y = this.holes[1];
    this.t = 0;
    this.anim = 0;
    this.phase = 0;
    this.scale = 1.0;
    this.telegraph = 0;
    this.hittable = false;
    this.mode = 'hide';        // hide | tel | out | (P3) sweep
    this.modeT = 1.2;
    this.holeIdx = 1;
    this.fireStep = 0;
    this.minionT = 8;
    this.trail = [];           // P3 몸통 궤적
    this.baseY = CFG.H * 0.5;
    this.flameT = 0;
    this.convergeT = 3.5;
    this.introT = 0;
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
    if (this.phase === 0 || this.transitionT > 0 || this.dead || !this.hittable) return;
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
      this.game.message('"여기서도 부우! 저기서도 부우!"', '#9fe8b8');
      this.mode = 'hide'; this.modeT = 0.8; this.hittable = false; this.x = CFG.W + 200;
      this.game.addBattery(1);
      this.game.phaseReward(this.x, this.y);
    } else if (p === 3) {
      this.game.message('"좋아, 진짜 유령 대행진이다~!"', '#c8ffd8');
      // 난파선을 떠나 헤엄쳐 나온다
      this.mode = 'sweep';
      this.hittable = true;
      this.x = CFG.W + 80;
      this.baseY = CFG.H * 0.5;
      this.trail = [];
      this.game.addBattery(1);
      this.game.phaseReward(this.x, this.y);
    } else if (p === 4) {
      // 진 대파도: 거울 분신 — 반투명 유령 뱀이 반대 위상으로 교차
      this.game.message('"유령은 원래... 둘이서 놀아! 부우부우!!"', '#e8fff0');
      this.game.addBattery(1);
      this.game.phaseReward(this.x, this.y);
    }
  }

  die() {
    this.dead = true;
    this.deathT = 0;
    Sound.sfx('bossDeath');
    this.hittable = false;
    this.game.clearBulletsToPearls(true);
    for (let i = 0; i < 48; i++) {
      const a = Math.random() * 6.28, s = 60 + Math.random() * 240;
      this.game.pearls.push(new Pearl(this.x, this.y, { vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: 15, auto: true }));
    }
    for (let i = 0; i < 5; i++) {
      const a = Math.random() * 6.28;
      this.game.pearls.push(new Pearl(this.x, this.y, { vx: Math.cos(a) * 130, vy: Math.sin(a) * 130, big: true, life: 15, auto: true }));
    }
    this.game.targetDark = 0;
    this.game.message('"...너 재밌다. 또 놀러 와! 부우~"', '#a8ffcf');
  }

  update(dt) {
    this.t += dt; this.anim += dt;
    const g = this.game;

    if (this.dead) {
      this.deathT += dt;
      this.y -= 20 * dt; // 스르르 떠오르며 성불(?)
      this.x -= 12 * dt;
      // 몸통도 머리를 따라 함께 떠오른다
      this.trail.unshift({ x: this.x, y: this.y });
      if (this.trail.length > 80) this.trail.pop();
      if (this.deathT > 2.6) g.victory();
      return;
    }

    // 등장: 구멍에서 빼꼼 → 소개
    if (this.phase === 0) {
      this.introT += dt;
      if (this.introT > 1.2) {
        this.phase = 1;
        g.message('유령 곰치 「부우」', '#9fe8b8');
        g.message('"부우~! ...안 놀랐어? 시시하다."', '#c8ffd8');
        this.mode = 'hide'; this.modeT = 1.4;
      }
      return;
    }

    if (this.transitionT > 0) { this.transitionT -= dt; return; }

    const m = this.mercy();
    if (this.telegraph > 0) this.telegraph -= dt;

    if (this.phase === 1 || this.phase === 2) {
      const p2 = this.phase === 2;
      if (this.mode === 'hide') {
        this.hittable = false;
        this.x = CFG.W + 200; // 표적 밖
        this.modeT -= dt;
        if (this.modeT <= 0) {
          this.holeIdx = Math.floor(Math.random() * this.holes.length);
          this.mode = 'tel';
          this.modeT = 0.7;
          if (g.dolphin && this.telegraph <= 0) this.telegraph = 0.7;
        }
      } else if (this.mode === 'tel') {
        // 구멍에서 거품 예고 (fx)
        if (Math.random() < 0.3) {
          g.fx.push({ x: this.holeX + (Math.random() - 0.5) * 20, y: this.holes[this.holeIdx],
                      vx: (Math.random() - 0.5) * 30, vy: -60 - Math.random() * 40,
                      life: 0.6, color: '#bfe8d8' });
        }
        this.modeT -= dt;
        if (this.modeT <= 0) {
          // 장난: 가끔 페이크 (거품만 내고 다른 구멍으로)
          if (Math.random() < (p2 ? 0.3 : 0.18)) {
            this.holeIdx = Math.floor(Math.random() * this.holes.length);
            this.modeT = 0.45;   // 짧은 2차 예고 후 진짜 등장
          } else {
            this.mode = 'out';
            this.modeT = p2 ? 1.7 : 1.9;
            this.fireStep = 0;
            this.emerge = 0;     // 구멍 속에서부터 미끄러져 나온다
            this.y = this.holes[this.holeIdx];
          }
        }
      } else if (this.mode === 'out') {
        this.modeT -= dt;
        // 미끄러져 나오기(0.28초) / 마지막에 도로 들어가기(0.28초)
        if (this.modeT > 0.28) this.emerge = Math.min(1, this.emerge + dt / 0.28);
        else this.emerge = Math.max(0, this.emerge - dt / 0.28);
        this.x = this.holeX + (this.outX - this.holeX) * this.emerge;
        this.y = this.holes[this.holeIdx] + Math.sin(this.anim * 4) * 4 * this.emerge;
        this.hittable = this.emerge > 0.5;  // 반쯤 나와야 맞는다
        const elapsed = (p2 ? 1.7 : 1.9) - this.modeT;
        if (this.fireStep === 0 && elapsed > 0.35) {
          this.fireStep = 1;
          if (p2) g.bossRing(this.x - 20, this.y, 14, 108, Math.random() * 6.28);
          else g.bossAimed(this.x - 30, this.y, 150, 3, 0.24);
        }
        if (this.fireStep === 1 && elapsed > 1.15) {
          this.fireStep = 2;
          g.bossAimed(this.x - 30, this.y, 160, 3, 0.22);
        }
        if (this.modeT <= 0) {
          this.mode = 'hide';
          this.modeT = (p2 ? 0.8 : 1.2) * m;
        }
      }
      // P2: 유령 부하 소환
      if (p2) {
        this.minionT -= dt;
        if (this.minionT <= 0) {
          this.minionT = 9 * m;
          const y = (0.2 + Math.random() * 0.6) * CFG.H;
          for (let i = 0; i < 2; i++) {
            g.spawner.pending.push({ at: g.stageT + i * 0.4, spec: {
              kind: 'ghost', M: 2, S: 0, hp: 2, spd: 115, amp: 25, freq: 2.5,
              x: CFG.W + 30, y: y + i * 50, dirX: -1, dirY: 0, groupId: -1, phase: 0,
            }});
          }
        }
      }
    } else if (this.phase >= 3) {
      // P3 대파도: 유령 대행진 — 장신 몸통이 화면을 뱀처럼 휘젓는다
      // 진 대파도(P4): 거울 분신이 상하 반전 위상으로 함께 휘젓는다 (두 뱀 사이를 누벼라)
      this.hittable = true;
      this.x -= 235 * dt;
      this.y = this.baseY + Math.sin(this.t * 2.4) * 130;
      if (this.x < -120) {
        this.x = CFG.W + 80;
        this.baseY = (0.3 + Math.random() * 0.4) * CFG.H;
        this.trail = [];
      }
      // 몸통 궤적 기록
      this.trail.unshift({ x: this.x, y: this.y });
      if (this.trail.length > 80) this.trail.pop();
      // 몸통 마디 vs 플레이어 (머리는 본체 충돌이 처리)
      const pl = g.player;
      for (let i = 10; i < this.trail.length; i += 10) {
        const seg = this.trail[i];
        const rr = CFG.playerHitR + 17;
        if ((seg.x - pl.x) ** 2 + (seg.y - pl.y) ** 2 < rr * rr) { pl.hit(g); break; }
        // 거울 분신 몸통 (P4): 상하 반전 위치
        if (this.phase === 4) {
          const my = CFG.H - seg.y;
          if ((seg.x - pl.x) ** 2 + (my - pl.y) ** 2 < rr * rr) { pl.hit(g); break; }
        }
      }
      // 거울 분신 머리 vs 플레이어 (P4)
      if (this.phase === 4) {
        const rr2 = CFG.playerHitR + 26;
        if ((this.x - pl.x) ** 2 + ((CFG.H - this.y) - pl.y) ** 2 < rr2 * rr2) pl.hit(g);
      }
      // 몸에서 유령불 뚝뚝
      this.flameT -= dt;
      if (this.flameT <= 0) {
        this.flameT = 0.5 * m;
        const seg = this.trail[Math.min(30, this.trail.length - 1)];
        if (seg) g.ebullets.push({ x: seg.x, y: seg.y, vx: -25, vy: (Math.random() - 0.5) * 40, r: CFG.ebR, kind: 'ghostflame' });
      }
      // 유령불 포위 링 (플레이어 중심으로 조여옴)
      this.convergeT -= dt;
      if (this.convergeT <= 0) {
        this.convergeT = 4.6 * m;
        if (g.dolphin && this.telegraph <= 0) this.telegraph = 0.5;
        const cx = pl.x, cy = pl.y;
        const cn2 = 10 + g.diff * 2; // 난이도: 포위 유령불 밀도
        for (let i = 0; i < cn2; i++) {
          const a = (i / cn2) * 6.28;
          const bx = cx + Math.cos(a) * 270, by = cy + Math.sin(a) * 270;
          g.ebullets.push({ x: bx, y: by, vx: (cx - bx) / 270 * 74, vy: (cy - by) / 270 * 74, r: CFG.ebR, kind: 'ghostflame' });
        }
      }
    }
  }

  draw(ctx) {
    // 난파선 골조 (배경, P3에선 반투명하게 물러남)
    ctx.save();
    ctx.globalAlpha = (this.phase === 3 ? 0.4 : 1) * (this.dead ? Math.max(0, 1 - this.deathT / 2) : 1);
    ctx.fillStyle = '#33291f';
    ctx.strokeStyle = '#1f1811'; ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.roundRect(CFG.W * 0.9, 20, CFG.W * 0.12, CFG.H - 40, 14);
    ctx.fill(); ctx.stroke();
    // 기울어진 돛대
    ctx.strokeStyle = '#3a2e22'; ctx.lineWidth = 8;
    ctx.beginPath(); ctx.moveTo(CFG.W * 0.93, 40); ctx.lineTo(CFG.W * 0.8, -30); ctx.stroke();
    // 구멍들 (선체 위)
    for (let i = 0; i < this.holes.length; i++) {
      ctx.fillStyle = '#120d08';
      ctx.beginPath(); ctx.ellipse(this.holeX, this.holes[i], 26, 20, 0, 0, 6.28); ctx.fill();
      ctx.strokeStyle = 'rgba(90,70,55,0.6)'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.ellipse(this.holeX, this.holes[i], 26, 20, 0, 0, 6.28); ctx.stroke();
    }
    ctx.restore();

    if (this.dead) {
      // 성불 중 — 몸통도 머리를 따라 함께 (머리만 떠 있으면 섭섭하니까)
      ctx.save();
      ctx.globalAlpha = Math.max(0, 1 - this.deathT / 2.6);
      for (let i = 10; i < this.trail.length; i += 10) {
        const seg = this.trail[i];
        const k = i / 80;
        ctx.save();
        ctx.globalAlpha *= (0.85 - k * 0.5);
        const r = 19 - k * 9;
        ctx.fillStyle = '#a8d8bc';
        ctx.beginPath(); ctx.arc(seg.x, seg.y, r, 0, 6.28); ctx.fill();
        ctx.restore();
      }
      this.drawHead(ctx, this.x, this.y, 1);
      ctx.restore();
      return;
    }
    if (this.phase === 0) {
      // 구멍에서 빼꼼
      this.drawHead(ctx, this.holeX - 18, this.holes[1], 0.7);
      return;
    }

    if (this.phase >= 3) {
      // 몸통 마디 (머리 궤적 추종 — 꼬리로 갈수록 가늘고 투명)
      for (let i = 10; i < this.trail.length; i += 10) {
        const seg = this.trail[i];
        const k = i / 80;
        ctx.save();
        ctx.globalAlpha = 0.85 - k * 0.5;
        const r = 19 - k * 9;
        const body = ctx.createRadialGradient(seg.x - 4, seg.y - 4, 2, seg.x, seg.y, r);
        body.addColorStop(0, '#c9f0d8');
        body.addColorStop(1, '#7fb99a');
        ctx.fillStyle = body;
        ctx.beginPath(); ctx.arc(seg.x, seg.y, r, 0, 6.28); ctx.fill();
        // 등지느러미 물결
        ctx.strokeStyle = 'rgba(159,232,184,0.6)'; ctx.lineWidth = 3;
        ctx.beginPath(); ctx.arc(seg.x, seg.y - r - 2, 6, Math.PI, 0); ctx.stroke();
        // 거울 분신 마디 (P4, 반투명)
        if (this.phase === 4) {
          ctx.globalAlpha *= 0.5;
          ctx.fillStyle = '#e8fff0';
          ctx.beginPath(); ctx.arc(seg.x, CFG.H - seg.y, r, 0, 6.28); ctx.fill();
        }
        ctx.restore();
      }
      this.drawHead(ctx, this.x, this.y, 1);
      if (this.phase === 4) {
        ctx.save();
        ctx.globalAlpha = 0.5;
        this.drawHead(ctx, this.x, CFG.H - this.y, 1);
        ctx.restore();
      }
    } else if (this.mode === 'out' || this.mode === 'tel') {
      // 구멍에서 미끄러져 나오는 중 — 작게 시작해 커진다
      if (this.mode === 'out') this.drawHead(ctx, this.x, this.y, 0.4 + 0.6 * this.emerge);
      // 힌트 예고 반짝
      if (this.telegraph > 0) {
        ctx.strokeStyle = `rgba(255, 240, 150, ${Math.min(1, this.telegraph)})`;
        ctx.lineWidth = 3;
        ctx.beginPath(); ctx.arc(this.holeX, this.holes[this.holeIdx], 42, 0, 6.28); ctx.stroke();
      }
    }
  }

  drawHead(ctx, x, y, s) {
    ctx.save();
    ctx.translate(x, y);
    const R = 30 * s;
    // 목 (구멍 쪽으로)
    if (this.phase !== 3 && !this.dead) {
      ctx.fillStyle = '#8fc9a8';
      ctx.beginPath(); ctx.ellipse(R * 0.9, 0, R * 1.1, R * 0.62, 0, 0, 6.28); ctx.fill();
    }
    // 머리 (유령빛 연두)
    const head = ctx.createRadialGradient(-R * 0.3, -R * 0.3, R * 0.2, 0, 0, R * 1.2);
    head.addColorStop(0, '#d4f5e0');
    head.addColorStop(1, '#8fc9a8');
    ctx.fillStyle = head;
    ctx.beginPath(); ctx.ellipse(0, 0, R * 1.15, R * 0.78, 0, 0, 6.28); ctx.fill();
    // 능글 입 (씨익 + 이빨)
    ctx.strokeStyle = '#3a5a4a'; ctx.lineWidth = 2.5 * s;
    ctx.beginPath(); ctx.arc(-R * 0.35, R * 0.1, R * 0.5, 0.25, Math.PI * 0.75); ctx.stroke();
    ctx.fillStyle = '#fff';
    for (let i = 0; i < 4; i++) {
      const tx = -R * 0.8 + i * R * 0.24;
      ctx.beginPath();
      ctx.moveTo(tx, R * 0.32);
      ctx.lineTo(tx + R * 0.09, R * 0.5);
      ctx.lineTo(tx + R * 0.18, R * 0.32);
      ctx.fill();
    }
    // 눈 (장난기)
    ctx.fillStyle = '#fff';
    ctx.beginPath(); ctx.arc(-R * 0.35, -R * 0.3, R * 0.2, 0, 6.28); ctx.fill();
    ctx.fillStyle = '#2a4438';
    ctx.beginPath(); ctx.arc(-R * 0.4, -R * 0.28, R * 0.09, 0, 6.28); ctx.fill();
    // 유령 아우라
    ctx.strokeStyle = 'rgba(159,232,184,0.35)'; ctx.lineWidth = 4;
    ctx.beginPath(); ctx.ellipse(0, 0, R * 1.35 + Math.sin(this.anim * 4) * 3, R * 0.95, 0, 0, 6.28); ctx.stroke();
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
        g.addColorStop(0, '#fff'); g.addColorStop(1, '#9fe8b8');
        ctx.fillStyle = g;
        ctx.beginPath(); ctx.arc(bx, y, 7, 0, 6.28); ctx.fill();
      } else {
        ctx.strokeStyle = 'rgba(255,255,255,0.3)'; ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.arc(bx, y, 5, 0, 6.28); ctx.stroke();
      }
    }
    ctx.fillStyle = '#c8ffd8'; ctx.font = Fonts.f(13); ctx.textAlign = 'center';
    ctx.fillText('유령 곰치 「부우」', CFG.W / 2, 50);
    ctx.restore();
  }
}
