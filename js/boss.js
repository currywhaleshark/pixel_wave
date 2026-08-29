// ============================================================
// boss.js — 보스 1호: 뾰족복어 「팡팡」 (GDD 9.2)
// P1 조준탄 교육 → P2 링+조준 복합 → P3 대파도
// 패턴 이름은 화면에 표시하지 않는다 — 전환은 대사로만.
// 내부 id/이름은 챌린지 모드(특정 패턴 고난도 재도전)용 데이터.
// ============================================================
const BOSS1_PATTERNS = {
  1: { id: 'pangpang-needle-fan',  name: '가시 삼연발' },
  2: { id: 'pangpang-bubble-ring', name: '부풀부풀 기포 링' },
  3: { id: 'pangpang-spa-bubbles', name: '뾰족뾰족 온천기포' },  // 대파도
  4: { id: 'pangpang-true-spa',    name: '진·뾰족뾰족 온천기포' },  // 하드 전용 진 대파도: 역회전 나선 교차
};

class Boss {
  constructor(game) {
    this.game = game;
    this.hp = CFG.bossHp;
    this.maxHp = CFG.bossHp;
    this.x = CFG.W + 80;
    this.y = CFG.H * 0.5;
    this.t = 0;               // 전투 경과 (자비 타이머)
    this.anim = 0;
    this.phase = 0;           // 0=등장, 1~3
    this.scale = 1;
    this.targetScale = 1;
    this.fireT = 1.5;
    this.ringCount = 0;
    this.telegraph = 0;       // 링 발사 예고 (0.5초 전 반짝)
    this.spiralAngle = 0;
    this.spikeT = 0;
    this.minionT = 4;
    this.transitionT = 0;     // 페이즈 전환 연출
    this.dead = false;
    this.deathT = 0;
    // 보통은 정식 P1 데이터, ?barrage=id 시험 모드에서는 에디터가 저장한 임의 패턴.
    this.barrageId = game.barragePatternId || BOSS1_PATTERNS[1].id;
    const pattern = typeof BarrageRuntime !== 'undefined' ? BarrageRuntime.get(this.barrageId) : null;
    this.barrageRunner = pattern ? new BarrageRuntime.Runner(pattern, {
      emit: bullet => game.ebullets.push(bullet),
    }) : null;
  }

  hpRatio() { return Math.max(0, this.hp / this.maxHp); }

  // 타임아웃 자비: 90초 초과 시 발사 간격이 점점 벌어짐
  mercy() {
    const over = this.t - CFG.bossMercyTime;
    return (over > 0 ? 1 + Math.min(1.2, over / 45) : 1) * (this.game.D?.bossInt ?? 1);
  }

  takeDamage(dmg) {
    if (this.phase === 0 || this.transitionT > 0 || this.dead) return;
    if (this.game.barragePatternId) return; // 탄막 시험 모드: 1페이즈를 계속 유지
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
    this.game.clearBulletsToPearls(false); // 페이즈 전환: 화면 정리 (진주 변환 없이 소멸)
    // 페이즈 전환 = 대사 한마디 (패턴명 표기 없음)
    if (p === 2) {
      this.targetScale = 1.4;
      this.game.message('"뿌우우!! 아직 안 끝났어!"', '#ffd76e');
      this.game.addBattery(1);
      this.game.phaseReward(this.x, this.y);   // 페이즈 돌파 보상: 배터리 +1
    } else if (p === 3) {
      this.targetScale = 1.75;
      this.game.message('"진짜로 화났다아—!! 뿌우우우!!"', '#ff9ec7');
      this.game.addBattery(1);
      this.game.phaseReward(this.x, this.y);
    } else if (p === 4) {
      // 진 대파도: 역회전 나선이 교차 — 안전지대가 여닫힌다
      this.targetScale = 1.95;
      this.game.message('"아직 하나 남았어!! 진짜 화났을 때 얘기!!"', '#ff6fa5');
      this.game.addBattery(1);
      this.game.phaseReward(this.x, this.y);
    }
  }

  die() {
    this.dead = true;
    this.deathT = 0;
    Sound.sfx('bossDeath');
    this.game.clearBulletsToPearls(true);  // 남은 탄 전부 진주로
    // 진주 폭죽
    for (let i = 0; i < 36; i++) {
      const a = Math.random() * 6.28, s = 60 + Math.random() * 220;
      this.game.pearls.push(new Pearl(this.x, this.y, { vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: 15, auto: true }));
    }
    for (let i = 0; i < 3; i++) {
      const a = Math.random() * 6.28;
      this.game.pearls.push(new Pearl(this.x, this.y, { vx: Math.cos(a) * 120, vy: Math.sin(a) * 120, big: true, life: 15, auto: true }));
    }
    this.game.say('"...집에 가는 길이었어? 미안!"', '"역시 세네~ 다음엔 내가 이긴다!"', '#a8ffcf');
  }

  update(dt) {
    this.t += dt; this.anim += dt;
    const g = this.game;
    this.scale += (this.targetScale - this.scale) * Math.min(1, dt * 4);

    if (this.dead) {
      this.deathT += dt;
      // 바람 빠지며 뱅글뱅글
      this.scale = Math.max(0.3, this.scale - dt * 0.6);
      this.x += Math.sin(this.deathT * 9) * 60 * dt;
      this.y += Math.cos(this.deathT * 7) * 50 * dt;
      if (this.deathT > 2.6) g.victory();
      return;
    }

    // 등장
    if (this.phase === 0) {
      this.x -= 90 * dt;
      if (this.x <= CFG.W * 0.78) {
        this.x = CFG.W * 0.78;
        this.phase = 1;
        g.message('뾰족복어 「팡팡」', '#ffd76e');
        g.say('"저리 가아—!!"', '"또 왔구나! 이번엔 진심으로 놀아줄 거야, 뿌우!"', '#ffb0c8');
      }
      return;
    }

    if (this.transitionT > 0) { this.transitionT -= dt; return; }

    // 둥실둥실
    this.y = CFG.H * 0.5 + Math.sin(this.anim * 1.1) * 26;

    const m = this.mercy();
    if (this.telegraph > 0) this.telegraph -= dt;

    if (this.phase === 1) {
      // P1: 에디터와 같은 실행기가 JSON 패턴을 재생한다.
      if (this.barrageRunner) {
        const realTimeToNext = this.barrageRunner.timeToNext() * m;
        if (g.dolphin && realTimeToNext <= 0.5 && realTimeToNext > 0 && this.telegraph <= 0) this.telegraph = 0.5;
        this.barrageRunner.update(dt / Math.max(0.05, m), {
          source: { x: this.x, y: this.y },
          target: g.player,
          difficulty: g.diff,
        });
        this.fireT = this.barrageRunner.timeToNext() * m; // 다음 페이즈 첫 발사 템포도 종전처럼 이어받는다.
      } else {
        // 생성 데이터가 빠졌을 때 게임이 무탄막으로 망가지지 않는 안전 폴백.
        this.fireT -= dt;
        if (this.fireT <= 0) {
          this.fireT = 2.0 * m;
          g.bossAimed(this.x - 20 * this.scale, this.y, 150, 3, 0.24);
        }
      }
      // 진주 셔틀 열대어
      if (!g.barragePatternId) this.minionT -= dt;
      if (!g.barragePatternId && this.minionT <= 0) {
        this.minionT = 7;
        const y = (0.2 + Math.random() * 0.6) * CFG.H;
        for (let i = 0; i < 3; i++) {
          g.spawner.pending.push({ at: g.stageT + i * 0.35, spec: {
            kind: 'fish', M: 2, S: 0, hp: 1, spd: 130, amp: 30, freq: 3,
            x: CFG.W + 30, y, dirX: -1, dirY: 0, groupId: -1, phase: 0,
          }});
        }
      }
    } else if (this.phase === 2) {
      // P2: 기포 링 16발(3초) + 링 2회마다 조준 세트
      this.fireT -= dt;
      if (g.dolphin && this.fireT <= 0.5 && this.telegraph <= 0 && this.fireT > 0) {
        this.telegraph = 0.5;   // 발사 예고 — 돌고래 동행 시에만 (힌트 기능)
      }
      if (this.fireT <= 0) {
        this.fireT = 3.0 * m;
        this.ringCount++;
        if (this.ringCount % 3 === 0) {
          g.bossAimed(this.x - 20 * this.scale, this.y, 155, 3, 0.22);
          g.bossAimed(this.x - 20 * this.scale, this.y, 125, 3, 0.22);
        } else {
          g.bossRing(this.x, this.y, 16, CFG.ebSpeedRing, Math.random() * 6.28);
        }
      }
    } else if (this.phase >= 3) {
      // P3 대파도: 나선 4줄기 회전(6초/바퀴) + 진주 가시 낙하
      // 나선과 같이 돌면 안 맞는 구조
      this.spiralAngle += (Math.PI * 2 / 6) * dt;
      if (this.phase === 4) this.spiralAngle2 = (this.spiralAngle2 ?? 0) - (Math.PI * 2 / 7.5) * dt; // 역회전
      this.fireT -= dt;
      if (this.fireT <= 0) {
        this.fireT = 0.15 * m;
        const arms = (this.phase === 4 ? 3 : 4) + (g.diff >= 2 && this.phase === 3 ? 1 : 0);
        // 진 대파도: 정회전 3 + 역회전 3 — 교차 타이밍을 읽어라
        if (this.phase === 4) {
          for (let k = 0; k < 3; k++) {
            const a2 = this.spiralAngle2 + k * (Math.PI * 2 / 3);
            g.ebullets.push({
              x: this.x + Math.cos(a2) * 30 * this.scale,
              y: this.y + Math.sin(a2) * 30 * this.scale,
              vx: Math.cos(a2) * CFG.ebSpeedSpiral,
              vy: Math.sin(a2) * CFG.ebSpeedSpiral,
              r: CFG.ebR, kind: 'spike',
            });
          }
        }
        for (let k = 0; k < arms; k++) {
          const a = this.spiralAngle + k * (Math.PI * 2 / arms);
          g.ebullets.push({
            x: this.x + Math.cos(a) * 30 * this.scale,
            y: this.y + Math.sin(a) * 30 * this.scale,
            vx: Math.cos(a) * CFG.ebSpeedSpiral,
            vy: Math.sin(a) * CFG.ebSpeedSpiral,
            r: CFG.ebR, kind: 'bubble',
          });
        }
      }
      this.spikeT -= dt;
      if (this.spikeT <= 0) {
        this.spikeT = 0.55 * m;
        g.ebullets.push({
          x: Math.random() * CFG.W * 0.7, y: -10,
          vx: Math.sin(this.anim * 3) * 15, vy: 62,
          r: CFG.ebR, kind: 'spike',
        });
      }
      // 원거리 캠핑 처벌: 나선 틈에 멀리 서 있으면 조준탄이 찾아온다
      this.p3AimT = (this.p3AimT ?? 1.5) - dt;
      if (this.p3AimT <= 0) {
        this.p3AimT = 2.4 * m;
        g.bossAimed(this.x - 20 * this.scale, this.y, 155, 3, 0.22);
      }
    }
  }

  draw(ctx) {
    ctx.save();
    ctx.translate(this.x, this.y);
    const s = this.scale;
    if (this.dead) ctx.rotate(this.deathT * 6);
    const R = 42 * s;
    const puff = 1 + Math.sin(this.anim * 3) * 0.03;

    // 예고 반짝 (P2 링 발사 0.5초 전)
    if (this.telegraph > 0) {
      ctx.strokeStyle = `rgba(255, 240, 150, ${this.telegraph})`;
      ctx.lineWidth = 3;
      ctx.beginPath(); ctx.arc(0, 0, R + 14, 0, 6.28); ctx.stroke();
    }

    // 가시
    ctx.strokeStyle = '#d8b23e'; ctx.lineWidth = 3 * s;
    const spikes = 14;
    for (let i = 0; i < spikes; i++) {
      const a = (i / spikes) * 6.28 + this.anim * 0.3;
      const len = R * (this.phase >= 2 ? 0.35 : 0.22);
      ctx.beginPath();
      ctx.moveTo(Math.cos(a) * R * 0.95 * puff, Math.sin(a) * R * 0.95 * puff);
      ctx.lineTo(Math.cos(a) * (R * puff + len), Math.sin(a) * (R * puff + len));
      ctx.stroke();
    }
    // 본체만 스프라이트로 교체하고, 위의 가시·예고 및 바깥 회전/부풀기 연출은 유지한다.
    if (Sprites.draw(ctx, 'boss.pangpang', 0, 0, { t: this.anim, scale: s * puff })) {
      ctx.restore();
      return;
    }
    // 몸통 (연두빛 노랑)
    const grad = ctx.createRadialGradient(-R * 0.3, -R * 0.3, R * 0.2, 0, 0, R);
    grad.addColorStop(0, '#fdf3a6');
    grad.addColorStop(1, '#e8c84e');
    ctx.fillStyle = grad;
    ctx.beginPath(); ctx.arc(0, 0, R * puff, 0, 6.28); ctx.fill();
    // 배 (하얀)
    ctx.fillStyle = 'rgba(255,255,255,0.75)';
    ctx.beginPath(); ctx.ellipse(0, R * 0.45, R * 0.6, R * 0.4, 0, 0, 6.28); ctx.fill();
    // 볼 (빵빵)
    ctx.fillStyle = 'rgba(255,140,140,0.6)';
    ctx.beginPath(); ctx.arc(-R * 0.45, R * 0.05, R * 0.18, 0, 6.28); ctx.fill();
    ctx.beginPath(); ctx.arc(R * 0.45, R * 0.05, R * 0.18, 0, 6.28); ctx.fill();
    // 눈 (화남 → 죽으면 @@)
    ctx.fillStyle = '#333';
    if (this.dead) {
      ctx.font = Fonts.f(10 * s); ctx.textAlign = 'center';
      ctx.fillText('@   @', 0, -R * 0.15);
    } else {
      ctx.beginPath(); ctx.arc(-R * 0.25, -R * 0.2, R * 0.09, 0, 6.28); ctx.fill();
      ctx.beginPath(); ctx.arc(R * 0.25, -R * 0.2, R * 0.09, 0, 6.28); ctx.fill();
      ctx.strokeStyle = '#333'; ctx.lineWidth = 2.5 * s;
      ctx.beginPath(); ctx.moveTo(-R * 0.4, -R * 0.38); ctx.lineTo(-R * 0.12, -R * 0.3); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(R * 0.4, -R * 0.38); ctx.lineTo(R * 0.12, -R * 0.3); ctx.stroke();
    }
    // 입 (뿌우)
    ctx.fillStyle = '#c46a4a';
    ctx.beginPath(); ctx.arc(0, R * 0.1, R * 0.09, 0, 6.28); ctx.fill();
    ctx.restore();
  }

  // 진주 목걸이 체력바
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
        ctx.fillStyle = '#e8b4d8';
        ctx.beginPath(); ctx.arc(bx, y, 7, 0, 6.28); ctx.fill();
        ctx.fillStyle = '#fff';
        ctx.fillRect(bx - 4, y - 4, 3, 3);   // 픽셀 하이라이트
      } else {
        ctx.strokeStyle = 'rgba(255,255,255,0.3)'; ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.arc(bx, y, 5, 0, 6.28); ctx.stroke();
      }
    }
    ctx.fillStyle = '#ffe9a8'; ctx.font = Fonts.f(13); ctx.textAlign = 'center';
    ctx.fillText('뾰족복어 「팡팡」', CFG.W / 2, 50);
    ctx.restore();
  }
}
