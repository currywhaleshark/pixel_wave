// ============================================================
// boss3.js — 보스 3호: 특송 가오리 「씽씽」 (거북이 고속도로, GDD 9.5)
// P1 돌진 → P2 차선 트래픽 → P3 대파도 「추월차선」
// 규칙: P3에서 차선마다 방향·속도가 다른 탄 트래픽이 흐른다.
//       차선 사이 틈으로 "차선 변경"하듯 움직이면 안전. 돌진은 항상 예고선.
// 톤: 성격 급한 스피드광 배달부.
// ============================================================
const BOSS3_PATTERNS = {
  1: { id: 'ssing-delivery-dash',  name: '특급 돌진' },
  2: { id: 'ssing-lane-traffic',   name: '차선 트래픽' },
  3: { id: 'ssing-overtake-lanes', name: '추월차선' },  // 대파도
  4: { id: 'ssing-round-trip',     name: '진·추월차선' },  // 하드 전용: 왕복 돌진
};

class BossSsing {
  constructor(game) {
    this.game = game;
    this.hp = CFG.boss3Hp;
    this.maxHp = CFG.boss3Hp;
    this.x = CFG.W + 100;
    this.y = CFG.H * 0.5;
    this.t = 0;
    this.anim = 0;
    this.phase = 0;
    this.scale = 1.1;
    this.targetScale = 1.1;
    this.telegraph = 0;       // 돌고래 힌트용
    this.mode = 'hover';      // P1/P3: hover | tel | dash
    this.modeT = 2.0;
    this.dashY = 0;
    this.dashTel = 0;         // 돌진 예고선 (항상 표시 — 공정성)
    this.trailT = 0;
    this.laneT = 1.5;         // P2 차선 스트림
    this.laneIdx = 0;
    this.summonT = 5;
    this.trafficT = 0.5;      // P3 트래픽
    this.dashCycleT = 4.5;    // P3 주기 돌진
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
    this.modeT = 2.0;
    this.x = CFG.W * 0.82;
    this.game.clearBulletsToPearls(false);
    if (p === 2) {
      this.game.message('"부릉부릉!! 차선 잘 봐!"', '#8fa3e8');
      this.game.addBattery(1);
      this.game.phaseReward(this.x, this.y);
    } else if (p === 3) {
      this.game.message('"풀스로틀이다아아—!!"', '#ff8f8f');
      this.game.addBattery(1);
      this.game.phaseReward(this.x, this.y);
    } else if (p === 4) {
      // 진 대파도: 왕복 돌진 — 나갔으면 되돌아온다
      this.game.message('"리미터 해제!! 왕복 배송이다아—!!"', '#ffb3b3');
      this.game.addBattery(1);
      this.game.phaseReward(this.x, this.y);
    }
  }

  die() {
    this.dead = true;
    this.deathT = 0;
    Sound.sfx('bossDeath');
    this.game.clearBulletsToPearls(true);
    for (let i = 0; i < 44; i++) {
      const a = Math.random() * 6.28, s = 60 + Math.random() * 240;
      this.game.pearls.push(new Pearl(this.x, this.y, { vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: 15, auto: true }));
    }
    for (let i = 0; i < 4; i++) {
      const a = Math.random() * 6.28;
      this.game.pearls.push(new Pearl(this.x, this.y, { vx: Math.cos(a) * 130, vy: Math.sin(a) * 130, big: true, life: 15, auto: true }));
    }
    this.game.say('"...집에 가는 길이었어? 그럼 진작 말하지~!"', '"크윽, 또 졌다! 다음엔 안 봐준다구!"', '#a8ffcf');
  }

  update(dt) {
    this.t += dt; this.anim += dt;
    const g = this.game;

    if (this.dead) {
      this.deathT += dt;
      // 신나게 화면 밖으로 쌩— (배달은 계속된다)
      this.x += 420 * dt;
      this.y -= 40 * dt;
      if (this.deathT > 2.4) g.victory();
      return;
    }

    // 등장: 왼쪽으로 쌩 지나갔다가 되돌아옴 (스피드광 소개)
    if (this.phase === 0) {
      this.x -= 500 * dt;
      if (this.x <= CFG.W * 0.82) {
        this.x = CFG.W * 0.82;
        this.phase = 1;
        g.message('특송 가오리 「씽씽」', '#8fa3e8');
        g.say('"비켜비켜—! 여긴 고속도로라구!"', '"오, 단골! 오늘도 한판 달려보자고!"', '#ffd76e');
      }
      return;
    }

    if (this.transitionT > 0) { this.transitionT -= dt; return; }

    const m = this.mercy();
    if (this.telegraph > 0) this.telegraph -= dt;
    if (this.dashTel > 0) this.dashTel -= dt;

    if (this.phase === 1) {
      // P1: 호버(조준 부채꼴) → 예고선 → 수평 돌진 (몸통이 흉기)
      if (this.mode === 'hover') {
        this.x += (CFG.W * 0.82 - this.x) * Math.min(1, dt * 3);
        this.y += (CFG.H * 0.5 + Math.sin(this.anim * 1.3) * 90 - this.y) * Math.min(1, dt * 4);
        this.modeT -= dt;
        if (g.dolphin && this.modeT <= 0.5 && this.modeT > 0 && this.telegraph <= 0) this.telegraph = 0.5;
        if (this.modeT <= 0) {
          g.bossAimed(this.x - 30, this.y, 165, 3, 0.22);
          this.mode = 'tel';
          this.modeT = 0.85;
          this.dashY = g.player.y;      // 플레이어 위치 스냅샷 — 이동하면 피해진다
          this.dashTel = 0.85;
        }
      } else if (this.mode === 'tel') {
        this.modeT -= dt;
        this.y += (this.dashY - this.y) * Math.min(1, dt * 6);
        if (this.modeT <= 0) { this.mode = 'dash'; }
      } else { // dash
        this.x -= 760 * dt;
        this.y = this.dashY;
        this.trailT -= dt;
        if (this.trailT <= 0) {
          this.trailT = 0.07;
          // 지나간 자리에 물살 탄 (위아래로 살짝 벌어짐)
          g.ebullets.push({ x: this.x + 30, y: this.y - 14, vx: 20, vy: -35, r: CFG.ebR, kind: 'bubble' });
          g.ebullets.push({ x: this.x + 30, y: this.y + 14, vx: 20, vy: 35, r: CFG.ebR, kind: 'bubble' });
        }
        if (this.x < -80) {
          this.x = CFG.W + 80;
          this.mode = 'hover';
          this.modeT = 2.2 * m;
        }
      }
    } else if (this.phase === 2) {
      // P2: 호버 + 차선 스트림(끊긴 콘보이) + 가오리 편대 소환
      this.x += (CFG.W * 0.82 - this.x) * Math.min(1, dt * 3);
      this.y = CFG.H * 0.5 + Math.sin(this.anim * 0.9) * 150;
      this.laneT -= dt;
      if (g.dolphin && this.laneT <= 0.5 && this.laneT > 0 && this.telegraph <= 0) this.telegraph = 0.5;
      if (this.laneT <= 0) {
        this.laneT = 1.7 * m;
        const laneY = [0.15, 0.32, 0.5, 0.68, 0.85][this.laneIdx % 5] * CFG.H;
        this.laneIdx += 2; // 5와 서로소 → 모든 차선 순회하되 연속 아님
        const cn = 8 + g.diff; // 난이도: 콘보이 길이 (틈은 2칸 유지)
        const gapIdx = 1 + Math.floor(Math.random() * (cn - 3));
        for (let i = 0; i < cn; i++) {
          if (i === gapIdx || i === gapIdx + 1) continue;
          g.ebullets.push({ x: CFG.W + 20 + i * 55, y: laneY, vx: -240, vy: 0, r: CFG.ebR, kind: 'spike' });
        }
      }
      // 노멀+: 차선 "사이"로 큰 탄이 지나다닌다 (차처럼) — 통로 캠핑 방지
      if (g.diff >= 1) {
        this.carT = (this.carT ?? 2.5) - dt;
        if (this.carT <= 0) {
          this.carT = (g.diff >= 2 ? 1.9 : 3.2) * m; // 하드: 더 자주
          const mids = [0.235, 0.41, 0.59, 0.765];   // 차선 사이 통로
          const y = mids[Math.floor(Math.random() * mids.length)] * CFG.H;
          const reverse = g.diff >= 2 && Math.random() < 0.35; // 하드: 가끔 역주행
          g.ebullets.push({
            x: reverse ? -30 : CFG.W + 30, y,
            vx: reverse ? 300 : -300, vy: 0, r: 13, kind: 'car',
          });
        }
      }
      this.summonT -= dt;
      if (this.summonT <= 0) {
        this.summonT = 9 * m;
        // 배달 후배들 (사냥 가능 — 진주 수급)
        const y = (0.25 + Math.random() * 0.5) * CFG.H;
        for (let i = 0; i < 3; i++) {
          g.spawner.pending.push({ at: g.stageT + i * 0.25, spec: {
            kind: 'ray', M: 1, S: 0, hp: 2, spd: 260, amp: 0, freq: 3,
            x: CFG.W + 30 + i * 40, y: y + (i - 1) * 46, dirX: -1, dirY: 0, groupId: -1, phase: 0,
          }});
        }
      }
    } else if (this.phase >= 3) {
      // P3 대파도: 추월차선 — 5개 차선에 방향·속도 제각각인 탄 트래픽 + 주기적 예고 돌진
      // 진 대파도(P4): 돌진이 왕복 — 왼쪽으로 나간 씽씽이 새 차선으로 되돌아온다
      // 호버 복귀는 hover 모드에서만! (돌진 중에 실행되면 두 힘이 평형을 이뤄 중간에 멈춰버림)
      if (this.mode === 'hover') {
        this.x += (CFG.W * 0.85 - this.x) * Math.min(1, dt * 2);
        this.y = CFG.H * 0.5 + Math.sin(this.anim * 0.7) * 110;
      }

      this.trafficT -= dt;
      if (this.trafficT <= 0) {
        this.trafficT = 0.4 * m;
        const per = g.diff >= 2 ? 2 : 1; // 하드: 틱당 2차선 동시 유입
        for (let k = 0; k < per; k++) {
          const lane = Math.floor(Math.random() * 5);
          const laneY = [0.15, 0.32, 0.5, 0.68, 0.85][lane] * CFG.H;
          const goRight = lane % 2 === 1;  // 홀수 차선은 역방향 (추월차선)
          const spd = 140 + lane * 22;
          g.ebullets.push({
            x: goRight ? -15 : CFG.W + 15, y: laneY + (Math.random() - 0.5) * 14,
            vx: goRight ? spd : -spd, vy: 0, r: CFG.ebR,
            kind: goRight ? 'bubble' : 'spike',
          });
        }
      }

      this.dashCycleT -= dt;
      if (this.dashCycleT <= 0 && this.mode === 'hover') {
        this.mode = 'tel';
        this.modeT = 0.9;
        this.dashY = [0.15, 0.32, 0.5, 0.68, 0.85][Math.floor(Math.random() * 5)] * CFG.H;
        this.dashTel = 0.9;
      }
      if (this.mode === 'tel') {
        this.modeT -= dt;
        this.y += (this.dashY - this.y) * Math.min(1, dt * 6);
        if (this.modeT <= 0) this.mode = 'dash';
      } else if (this.mode === 'dash') {
        this.x -= 820 * dt;
        this.y = this.dashY;
        if (this.x < -80) {
          if (this.phase === 4) {
            // 왕복: 왼쪽에서 새 차선 예고 후 되돌아온다
            this.mode = 'telBack';
            this.modeT = 0.8;
            this.dashY = [0.15, 0.32, 0.5, 0.68, 0.85][Math.floor(Math.random() * 5)] * CFG.H;
            this.dashTel = 0.8;
            this.x = -80;
          } else {
            this.x = CFG.W + 80;
            this.mode = 'hover';
            this.dashCycleT = 5.2 * m;
          }
        }
      } else if (this.mode === 'telBack') {
        this.modeT -= dt;
        this.y += (this.dashY - this.y) * Math.min(1, dt * 6);
        if (this.modeT <= 0) this.mode = 'dashBack';
      } else if (this.mode === 'dashBack') {
        this.x += 820 * dt;
        this.y = this.dashY;
        if (this.x > CFG.W + 80) {
          this.mode = 'hover';
          this.dashCycleT = 5.6 * m;
        }
      }
    }
  }

  draw(ctx) {
    // 돌진 예고선 (항상 표시 — 공정성. 화면 좌표계라 translate 밖에서)
    if (this.dashTel > 0) {
      ctx.save();
      ctx.globalAlpha = Math.min(0.55, this.dashTel);
      const blink = Math.floor(this.dashTel * 10) % 2 === 0;
      ctx.fillStyle = blink ? 'rgba(255,110,110,0.35)' : 'rgba(255,160,110,0.25)';
      ctx.fillRect(0, this.dashY - 22, CFG.W, 44);
      ctx.strokeStyle = '#ff8f8f'; ctx.lineWidth = 1.5;
      ctx.setLineDash([14, 10]);
      ctx.beginPath(); ctx.moveTo(0, this.dashY - 22); ctx.lineTo(CFG.W, this.dashY - 22); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(0, this.dashY + 22); ctx.lineTo(CFG.W, this.dashY + 22); ctx.stroke();
      ctx.setLineDash([]);
      ctx.restore();
    }

    ctx.save();
    ctx.translate(this.x, this.y);
    const s = this.scale;
    const R = 40 * s;
    if (this.dead) ctx.globalAlpha = Math.max(0, 1 - this.deathT / 2.4);
    const dashing = this.mode === 'dash';
    const flap = Math.sin(this.anim * (dashing ? 14 : 5)) * (dashing ? 10 : 6);

    // 돌진 중 스피드 잔상
    if (dashing) {
      ctx.fillStyle = 'rgba(143,163,232,0.25)';
      for (let k = 1; k <= 3; k++) {
        ctx.beginPath(); ctx.ellipse(k * 34, 0, R * 0.8, R * 0.3, 0, 0, 6.28); ctx.fill();
      }
    }

    // 힌트 예고 반짝 (돌고래)
    if (this.telegraph > 0) {
      ctx.strokeStyle = `rgba(255, 240, 150, ${this.telegraph})`;
      ctx.lineWidth = 3;
      ctx.beginPath(); ctx.arc(0, 0, R + 18, 0, 6.28); ctx.stroke();
    }

    // 빨간 스카프 (스피드광의 상징, 뒤로 나부낌)
    ctx.strokeStyle = '#ff6b6b'; ctx.lineWidth = 5 * s;
    ctx.beginPath();
    ctx.moveTo(R * 0.35, -R * 0.1);
    ctx.quadraticCurveTo(R * 0.9, -R * 0.15 + Math.sin(this.anim * 8) * 8, R * 1.4, Math.sin(this.anim * 8 + 1) * 12);
    ctx.stroke();

    // 본체만 스프라이트로 교체한다. 스카프·돌진 예고·잔상은 위의 코드 연출을 유지한다.
    if (Sprites.draw(ctx, 'boss.ssing', 0, 0, { t: this.anim, scale: s })) {
      ctx.restore();
      return;
    }

    // 몸통: 큰 가오리 날개
    ctx.fillStyle = '#7189d8';
    ctx.beginPath();
    ctx.moveTo(-R, 0);
    ctx.quadraticCurveTo(0, -R * 0.95 - flap, R * 0.95, -R * 0.18);
    ctx.quadraticCurveTo(R * 0.35, 0, R * 0.95, R * 0.18);
    ctx.quadraticCurveTo(0, R * 0.95 + flap, -R, 0);
    ctx.fill();
    // 배 무늬
    ctx.fillStyle = 'rgba(226,232,255,0.35)';
    ctx.beginPath();
    ctx.moveTo(-R * 0.7, 0);
    ctx.quadraticCurveTo(0, -R * 0.4, R * 0.6, 0);
    ctx.quadraticCurveTo(0, R * 0.4, -R * 0.7, 0);
    ctx.fill();
    // 꼬리
    ctx.strokeStyle = '#5a6fc0'; ctx.lineWidth = 3 * s;
    ctx.beginPath();
    ctx.moveTo(R * 0.9, 0);
    ctx.quadraticCurveTo(R * 1.3, Math.sin(this.anim * 6) * 10, R * 1.7, Math.sin(this.anim * 6 + 1) * 14);
    ctx.stroke();
    // 눈 (의욕 활활)
    ctx.fillStyle = '#fff';
    ctx.beginPath(); ctx.arc(-R * 0.45, -R * 0.12, R * 0.13, 0, 6.28); ctx.fill();
    if (this.dead) {
      ctx.fillStyle = '#333';
      ctx.font = Fonts.f(8 * s); ctx.textAlign = 'center';
      ctx.fillText('><', -R * 0.45, -R * 0.08);
    } else {
      ctx.fillStyle = '#333';
      ctx.beginPath(); ctx.arc(-R * 0.48, -R * 0.12, R * 0.06, 0, 6.28); ctx.fill();
      ctx.strokeStyle = '#333'; ctx.lineWidth = 2 * s;
      ctx.beginPath(); ctx.moveTo(-R * 0.62, -R * 0.3); ctx.lineTo(-R * 0.34, -R * 0.22); ctx.stroke();
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
        g.addColorStop(0, '#fff'); g.addColorStop(1, '#8fa3e8');
        ctx.fillStyle = g;
        ctx.beginPath(); ctx.arc(bx, y, 7, 0, 6.28); ctx.fill();
      } else {
        ctx.strokeStyle = 'rgba(255,255,255,0.3)'; ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.arc(bx, y, 5, 0, 6.28); ctx.stroke();
      }
    }
    ctx.fillStyle = '#c3ceff'; ctx.font = Fonts.f(13); ctx.textAlign = 'center';
    ctx.fillText('특송 가오리 「씽씽」', CFG.W / 2, 50);
    ctx.restore();
  }
}
