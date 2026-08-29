// ============================================================
// entities.js — 플레이어 / 적 / 탄 / 진주 (임시 도형 스프라이트)
// ============================================================

// ---------- 플레이어 (인어) ----------
class Player {
  constructor() {
    this.x = CFG.W * 0.2;
    this.y = CFG.H * 0.5;
    this.level = 1;          // 샷 Lv1~3
    this.gauge = 0;          // 파워 게이지 (진주)
    this.invuln = 0;
    this.fireT = 0;
    this.bubble = 0;         // >0 이면 격침 상태 (기포 리스폰 대기)
    this.slowVisual = false;
    this.anim = 0;
    this.armor = Meta.armorCharges(); // 진주 목걸이 (판마다 1회 격침 방어)
  }

  maxSpeed() { return CFG.playerSpeed * Meta.speedMult(); }

  gaugeMax() { return this.level === 1 ? CFG.gaugeLv2 : CFG.gaugeLv3; }

  addPearl(game, n = 1, gaugeGain = n) {
    game.stats.pearls += n;
    if (this.level < 3) {
      this.gauge += gaugeGain;
      while (this.level < 3 && this.gauge >= this.gaugeMax()) {
        this.gauge -= this.gaugeMax();
        this.level++;
        Sound.sfx('powerup');
        game.message(`파워 업! Lv${this.level}`, '#7dffd8');
      }
      if (this.level === 3) this.gauge = 0;
    }
  }

  update(dt, game) {
    this.anim += dt;
    if (this.invuln > 0) this.invuln -= dt;

    if (this.bubble > 0) {
      this.bubble -= dt;
      if (this.bubble <= 0) this.invuln = CFG.respawnInvuln;
      return; // 기포 안에서는 조작 불가
    }

    // --- 이동: 속도 상한 통일 (GDD 3장) ---
    let vx = 0, vy = 0;
    this.slowVisual = false;
    if (Input.mode === 'keys') {
      const m = Input.keyMove();
      const spd = m.slow ? CFG.playerSlowSpeed : this.maxSpeed();
      this.slowVisual = m.slow;
      vx = m.dx * spd; vy = m.dy * spd;
    } else if (Input.pointer.active) {
      // 해류가 추종 목표를 민다 — 위치추종 조작은 힘이 자동 보정되므로
      // 목표 오프셋으로 줘야 "몸이 쓸리는" 체감이 생긴다 (커서보다 흐름 쪽으로 밀림)
      const tx = Input.pointer.x + (game.curX || 0) * 0.6;
      const ty = Input.pointer.y + (game.curY || 0) * 0.6;
      const dx = tx - this.x;
      const dy = ty - this.y;
      const dist = Math.hypot(dx, dy);
      if (dist > 2) {
        // 포인터를 향해 최대속도로 유영 — 가까우면 자연 감속
        const spd = Math.min(this.maxSpeed(), dist * 8);
        vx = dx / dist * spd; vy = dy / dist * spd;
        this.slowVisual = dist < 40;
      }
    }
    // 부력: 아주 미세하게 떠오름 (맛보기)
    vy -= 6;
    // 해류 (폭풍 수면): 흐름이 몸을 민다
    vx += game.curX || 0;
    vy += game.curY || 0;

    this.x = Math.max(20, Math.min(CFG.W - 20, this.x + vx * dt));
    this.y = Math.max(game.surfaceY ?? 20, Math.min(CFG.H - 20, this.y + vy * dt));

    // --- 자동발사 (전 입력 공통) ---
    this.fireT -= dt;
    if (this.fireT <= 0) {
      this.fireT = CFG.fireInterval;
      this.fire(game);
    }
  }

  fire(game) {
    Sound.sfx('shot');
    const mk = (angleDeg, amp, pierce, back) => {
      const a = angleDeg * Math.PI / 180;
      game.shots.push({
        x: this.x + (back ? -14 : 14), y: this.y,
        dirX: back ? -Math.cos(a) : Math.cos(a),
        dirY: Math.sin(a),
        baseX: this.x, baseY: this.y,
        t: 0, amp, phase: Math.random() * 6.28,
        pierce, r: 5,
      });
    };
    // 통상샷은 관통 없음 — 관통은 은빛돌고래의 정체성 (GDD 6장)
    if (this.level === 1) {
      mk(0, 10, 0, false);
    } else if (this.level === 2) {
      // 2줄: 위상 반대 물결 (땋은 머리처럼 교차)
      mk(0, 12, 0, false);
      mk(0, 12, 0, false);
      game.shots[game.shots.length - 1].phase = game.shots[game.shots.length - 2].phase + Math.PI;
    } else {
      mk(-8, 8, 0, false); mk(0, 12, 0, false); mk(8, 8, 0, false);
      mk(0, 0, 0, true); // 후방 꼬리탄
    }
  }

  // 피격 처리. 반환: 실제로 맞았으면 true
  hit(game) {
    if (this.invuln > 0 || this.bubble > 0) return false;
    if (this.level > 1) {
      // 레벨 다운 + 진주 튕김: 보유분에서 실제로 차감해 흩뿌린다(복제 아님).
      // 0.35초간 회수 불가 — 그동안 바깥으로 튕겨나가고, 이후 3초 안에 주우면 회수.
      this.level--;
      this.gauge = 0;
      this.invuln = CFG.hitInvuln;
      const n = Math.min(CFG.hitScatterPearls, game.stats.pearls);
      game.stats.pearls -= n;
      for (let i = 0; i < n; i++) {
        const a = Math.random() * 6.28, s = 150 + Math.random() * 130;
        game.pearls.push(new Pearl(
          this.x + Math.cos(a) * 12, this.y + Math.sin(a) * 12, {
            vx: Math.cos(a) * s, vy: Math.sin(a) * s,
            life: CFG.scatterLife, scattered: true, noCollectT: CFG.scatterNoCollect,
          }));
      }
      Sound.sfx('playerHit');
      game.message('앗! 파워 다운...', '#ffb0c8');
    } else if (this.armor > 0) {
      // 진주 목걸이가 격침 1회 방어
      this.armor--;
      this.invuln = CFG.hitInvuln;
      Sound.sfx('shield');
      game.message('진주 목걸이가 지켜줬다!', '#ffe9a8');
      game.addFx(this.x, this.y, '#ffe9a8', 16);
    } else {
      // 격침 → 기포 리스폰
      this.bubble = CFG.bubbleTime;
      game.stats.deaths++;
      const loss = Math.floor(game.stats.pearls * CFG.downPearlLossRate);
      game.stats.pearls -= loss;
      Sound.sfx('playerDown');
      game.message('뽀글... 잠시 후 부활!', '#a8d8ff');
    }
    if (game.runLog) game.runLog.hitsTaken++;
    game.mult = Math.max(1, Math.round(game.mult * 50) / 100);   // 배율 반토막
    game.addFx(this.x, this.y, '#ff9ec7', 14);
    return true;
  }

  draw(ctx) {
    const t = this.anim;

    // 스프라이트가 있으면 그것으로, 없으면 아래 임시 도형으로 (교체는 항목별로)
    if (Sprites.draw(ctx, this.bubble > 0 ? 'mermaid.bubble' : 'mermaid.swim', this.x, this.y, {
      t, alpha: (this.invuln > 0 && this.bubble <= 0 && Math.floor(t * 12) % 2 === 0) ? 0.35 : 1,
    })) {
      // 기포·탑승 아우라는 상태 이펙트이므로 본체 스프라이트와 별도로 유지한다.
      ctx.save();
      ctx.translate(this.x, this.y);
      if (this.bubble > 0) {
        ctx.globalAlpha = 0.85;
        ctx.strokeStyle = '#bfe8ff'; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(0, 0, 24 + Math.sin(t * 6) * 2, 0, 6.28); ctx.stroke();
      } else if (typeof Game !== 'undefined' && Game.ride) {
        ctx.strokeStyle = `rgba(255,230,140,${0.5 + Math.sin(t * 6) * 0.2})`;
        ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(0, 4, 30, 0, 6.28); ctx.stroke();
      }
      ctx.restore();
      this.drawHitbox(ctx);
      return;
    }

    ctx.save();
    ctx.translate(this.x, this.y);
    if (this.bubble > 0) {
      // 격침: 큰 기포에 감싸임
      ctx.globalAlpha = 0.85;
      ctx.strokeStyle = '#bfe8ff'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(0, 0, 24 + Math.sin(t * 6) * 2, 0, 6.28); ctx.stroke();
      ctx.globalAlpha = 0.5;
    } else if (typeof Game !== 'undefined' && Game.ride) {
      // 탑승 중: 깜빡임 대신 황금빛 보호 아우라
      ctx.strokeStyle = `rgba(255,230,140,${0.5 + Math.sin(t * 6) * 0.2})`;
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(0, 4, 30, 0, 6.28); ctx.stroke();
    } else if (this.invuln > 0 && Math.floor(t * 12) % 2 === 0) {
      ctx.globalAlpha = 0.35; // 무적 깜빡임
    }
    // --- 임시 인어: 분홍 머리 + 청록 꼬리 ---
    const wag = Math.sin(t * 8) * 4;
    // 꼬리
    ctx.fillStyle = '#3fd8c7';
    ctx.beginPath();
    ctx.moveTo(-4, 0);
    ctx.quadraticCurveTo(-16, -3, -22, wag - 7);
    ctx.lineTo(-19, wag);
    ctx.lineTo(-22, wag + 7);
    ctx.quadraticCurveTo(-16, 3, -4, 0);
    ctx.fill();
    // 몸통
    ctx.fillStyle = '#ffd9b8';
    ctx.beginPath(); ctx.ellipse(2, 0, 8, 6, 0, 0, 6.28); ctx.fill();
    // 머리카락 (분홍)
    ctx.fillStyle = '#ff9ec7';
    ctx.beginPath(); ctx.arc(8, -3, 6, 0, 6.28); ctx.fill();
    ctx.beginPath(); ctx.ellipse(2, -4, 7, 4, -0.4, 0, 6.28); ctx.fill();
    // 얼굴
    ctx.fillStyle = '#ffe6d1';
    ctx.beginPath(); ctx.arc(10, -2, 4, 0, 6.28); ctx.fill();
    ctx.fillStyle = '#333';
    ctx.fillRect(11, -3, 1.6, 2.2);
    ctx.restore();
    this.drawHitbox(ctx);
  }

  // 피격판정 표시 (저속/포인터 근접 시) — 스프라이트 유무와 무관하게 항상 같은 규칙
  drawHitbox(ctx) {
    if (!this.slowVisual || this.bubble > 0) return;
    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.fillStyle = '#ffffff';
    ctx.beginPath(); ctx.arc(0, 0, CFG.playerHitR, 0, 6.28); ctx.fill();
    ctx.strokeStyle = '#ff6fa5'; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.arc(0, 0, CFG.playerHitR + 2, 0, 6.28); ctx.stroke();
    ctx.restore();
  }
}

// ---------- 진주 ----------
class Pearl {
  constructor(x, y, opt = {}) {
    this.x = x; this.y = y;
    this.vx = opt.vx ?? (Math.random() - 0.5) * 60;
    this.vy = opt.vy ?? (Math.random() - 0.5) * 60;
    this.big = opt.big ?? false;      // 편대 전멸 보너스
    this.value = this.big ? 10 : 1;
    this.life = opt.life ?? 12;
    this.scattered = opt.scattered ?? false;
    this.stream = opt.stream ?? false;
    this.auto = opt.auto ?? false;   // 자동 흡수 (거리 무관 — 페이즈 돌파 보상)
    this.noCollectT = opt.noCollectT ?? 0; // >0 동안 자석·회수 비활성 (바깥으로 튕겨나가는 구간)
    this.t = Math.random() * 6.28;
  }
  update(dt, player) {
    this.t += dt; this.life -= dt;
    if (this.noCollectT > 0) this.noCollectT -= dt;
    // 자석 흡수
    const dx = player.x - this.x, dy = player.y - this.y;
    const d = Math.hypot(dx, dy) || 0.0001; // 거리 0 가드 (NaN 방지)
    if ((d < CFG.pearlMagnetR || this.auto) && player.bubble <= 0 && this.noCollectT <= 0) {
      // 속도를 플레이어 방향으로 직접 조향.
      // (가속 방식은 접선 속도가 안 죽어서 플레이어가 움직이면 궤도를 돌게 됨)
      const spd = Math.max(
        Math.hypot(this.vx, this.vy),
        CFG.pearlMagnetSpeed + Math.max(0, 1 - d / CFG.pearlMagnetR) * 320,
        this.auto ? 380 : 0,  // 자동 흡수 진주는 멀어도 시원하게 날아온다
      );
      const k = Math.min(1, dt * 12);
      this.vx += (dx / d * spd - this.vx) * k;
      this.vy += (dy / d * spd - this.vy) * k;
    } else if (this.stream) {
      // 트레일 진주 (거북 택시 구간): 감속 없이 흘러감
    } else {
      // 스크롤 흐름: 인어가 오른쪽으로 나아가므로 떠 있는 것들은 왼쪽으로 흘러감 (배경과 동일)
      this.vx += (-30 - this.vx) * 1.2 * dt;
      this.vy *= (1 - 2.2 * dt);
      this.vy -= 6 * dt; // 살짝 부력
    }
    this.x += this.vx * dt; this.y += this.vy * dt;
  }
  draw(ctx) {
    const r = this.big ? 9 : 4.5;
    const blink = this.scattered && this.life < 1 && Math.floor(this.life * 10) % 2 === 0;
    if (blink) return;
    if (Sprites.draw(ctx, this.big ? 'pearl.big' : 'pearl.small', this.x, this.y, { t: this.t })) return;
    ctx.save();
    ctx.translate(this.x, this.y);
    const g = ctx.createRadialGradient(-r * 0.3, -r * 0.3, 0, 0, 0, r);
    g.addColorStop(0, '#ffffff');
    g.addColorStop(0.7, this.big ? '#ffe9a8' : '#e8d8ff');
    g.addColorStop(1, this.big ? '#f2b64e' : '#b39ddb');
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(0, 0, r, 0, 6.28); ctx.fill();
    if (this.big) {
      ctx.fillStyle = '#fff';
      ctx.font = Fonts.f(8); ctx.textAlign = 'center';
      ctx.fillText('★', 0, 3);
    }
    ctx.restore();
  }
}

// ---------- 적 ----------
// spec: { kind, x, y, hp, M, S, spd, amp, freq, targetX, groupId, fire:{...} }
class Enemy {
  constructor(spec) {
    Object.assign(this, spec);
    this.t = 0;
    this.y0 = this.y;
    this.x0 = this.x;
    this.phase = spec.phase ?? Math.random() * 6.28;
    this.fireT = spec.fireDelay ?? 0.6;
    this.state = 'enter';   // M3용: enter → pause → exit
    this.pauseT = 0;
    this.dead = false;
    this.escaped = false;
    this.maxHp = this.hp;
    this.flash = 0;
    if (this.kind === 'wreck') {
      const seed = spec.variant ?? Math.floor((spec.y ?? 0) / 48) + (spec.side === 'top' ? 1 : 0);
      this.wreckVariant = ((seed % 4) + 4) % 4;
    }
  }

  update(dt, game) {
    this.t += dt;
    if (this.flash > 0) this.flash -= dt;
    const M = this.M, spd = this.spd;

    // 유령: 실체(1.6초) ↔ 반투명 무적(0.8초) 사이클
    if (this.kind === 'ghost') this.solid = (this.t % 2.4) < 1.6;

    // 난파선 지형: 스크롤보다 빠르게 흘러오는 장애물 (전경 패럴랙스)
    if (this.kind === 'wreck') {
      this.x -= spd * dt;
      if (this.x < -80) this.escaped = true;
      return;
    }

    // --- 이동 (잡몹 문법 M축) ---
    if (M === 1) {              // 직진 통과
      this.x += this.dirX * spd * dt;
      this.y += this.dirY * spd * dt;
    } else if (M === 2) {       // 사인파 통과 (dirX 부호로 진행 방향 — D5는 +1)
      this.x += (this.dirX || -1) * spd * dt;
      this.y = this.y0 + this.amp * Math.sin(this.t * this.freq + this.phase);
    } else if (M === 4) {       // 유턴: 들어왔다가 호를 그리며 되돌아감 (뒤통수 교육)
      if (this.vx === undefined) this.vx = -spd;
      this.vx = Math.min(spd * 1.15, this.vx + spd * 0.85 * dt);
      this.x += this.vx * dt;
      this.y = this.y0 + Math.sin(this.t * 1.8) * 18;
    } else if (M === 5) {       // 완만 추적 (급선회 금지 — 몸으로 피해지는 수준)
      if (this.vx === undefined) { this.vx = -spd; this.vy = 0; }
      if (this.t < 9) {         // 9초 후 추적 포기, 직진 이탈
        const p = game.player;
        const want = Math.atan2(p.y - this.y, p.x - this.x);
        const cur = Math.atan2(this.vy, this.vx);
        let diff = want - cur;
        while (diff > Math.PI) diff -= Math.PI * 2;
        while (diff < -Math.PI) diff += Math.PI * 2;
        const turn = 1.1 * dt;
        const a = cur + Math.max(-turn, Math.min(turn, diff));
        this.vx = Math.cos(a) * spd; this.vy = Math.sin(a) * spd;
      }
      this.x += this.vx * dt; this.y += this.vy * dt;
    } else if (M === 3) {       // 정지-사격-이탈
      if (this.state === 'enter') {
        this.x -= spd * dt;
        if (this.x <= this.targetX) { this.state = 'pause'; this.pauseT = this.pauseDur ?? 2.2; }
      } else if (this.state === 'pause') {
        this.pauseT -= dt;
        this.y = this.y0 + Math.sin(this.t * 2) * 6;
        if (this.pauseT <= 0) this.state = 'exit';
      } else {
        this.x -= spd * 1.7 * dt; // 이탈 가속
      }
    } else if (M === 6) {       // 붙박이 포대 (스크롤 따라 흘러옴)
      this.x -= CFG.scrollSpeed * dt;
    } else if (M === 7) {       // 해류 편승: 흐름을 타고 가감속 (서핑)
      this.x += ((this.dirX || -1) * spd + (game.curX || 0) * 1.4) * dt;
      this.y = this.y0 + this.amp * Math.sin(this.t * this.freq + this.phase) + (game.curY || 0) * 0.6;
    }

    // --- 사격 (S축) ---
    if (this.S !== 0 && this.x > 30 && this.x < CFG.W - 10 && (this.kind !== 'ghost' || this.solid)) {
      const canFire = (this.M !== 3) || (this.state === 'pause');
      if (canFire) {
        this.fireT -= dt;
        if (this.fireT <= 0) {
          this.fireT = this.fireInt ?? 2.0;
          this.shoot(game);
        }
      }
    }

    // 화면 이탈
    if (this.x < -60 || this.x > CFG.W + 120 || this.y < -80 || this.y > CFG.H + 80) {
      this.escaped = true;
    }
  }

  shoot(game) {
    const S = this.S;
    const di = game.diff ?? 0;  // 난이도별 사격 패턴 진화 (0=이지, 1=노멀, 2=하드)
    if (S === 1) {
      // 조준: 이지 1발 → 노멀 2발 부채꼴 → 하드 3발 부채꼴
      game.spawnAimed(this.x, this.y, CFG.ebSpeedAimed, 1 + di, di > 0 ? 0.18 : 0);
    } else if (S === 2) {
      // 전방위 링 (ringN — 난이도로 탄수 상향 적용됨)
      game.spawnRing(this.x, this.y, this.ringN ?? 8, CFG.ebSpeedRing * 0.9, Math.random() * 6.28);
      // 노멀+: 링과 함께 노리고 쏘는 조준탄
      if (di >= 1) game.spawnAimed(this.x, this.y, CFG.ebSpeedAimed * 0.95, 1, 0);
      // 하드: 무작위 흩뿌리기 3발 추가 (읽기 어려운 잔탄)
      if (di >= 2) {
        for (let i = 0; i < 3; i++) {
          const a = Math.random() * 6.28;
          const sp = 70 + Math.random() * 80;
          game.ebullets.push({ x: this.x, y: this.y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, r: CFG.ebR, kind: 'bubble' });
        }
      }
    } else if (S === 3) {
      // 낙하: 이지 1발 똑 → 노멀 V자 2발 → 하드 부채꼴 3발 흩뿌림
      const n = 1 + di;
      for (let i = 0; i < n; i++) {
        const vx = n === 1 ? -20
          : (i - (n - 1) / 2) * 55 + (di >= 2 ? (Math.random() - 0.5) * 35 : 0);
        game.ebullets.push({ x: this.x, y: this.y + 8, vx, vy: CFG.ebSpeedDrop, r: CFG.ebR, kind: 'drop' });
      }
    } else if (S === 4) {   // 설치: 등불 기뢰 (시간차 링 폭발, 난이도로 타이머 단축)
      game.ebullets.push({ x: this.x, y: this.y + 8, vx: -8, vy: 14, r: 7, kind: 'mine',
        timer: CFG.mineTimer * (game.D?.mineT ?? 1) });
    }
  }

  takeDamage(dmg, game) {
    if (this.kind === 'wreck') return;
    Sound.sfx('hit');                    // 지형은 불괴
    if (this.kind === 'ghost' && !this.solid) return;     // 반투명 유령은 무적
    this.hp -= dmg;
    this.flash = 0.08;
    if (this.hp <= 0) {
      this.dead = true;
      game.onEnemyKilled(this);
    }
  }

  draw(ctx) {
    // 스프라이트 우선, 없으면 임시 도형 (kind 이름이 곧 스프라이트 id)
    let alpha = this.flash > 0 ? 0.6 : 1;
    if (this.kind === 'ghost') alpha *= this.solid ? 0.9 : 0.25;
    if (this.kind === 'wreck' && Sprites.has('enemy.wreck')) {
      const sprite = SPRITES['enemy.wreck'];
      const tileH = sprite.h * CFG.pxUnit;
      const top = this.y - this.wreckH / 2;
      const bottom = this.y + this.wreckH / 2;
      ctx.save();
      ctx.beginPath();
      ctx.rect(this.x - this.wreckW / 2, top, this.wreckW, this.wreckH);
      ctx.clip();
      for (let y = top + tileH / 2; y < bottom + tileH; y += tileH) {
        Sprites.draw(ctx, 'enemy.wreck', this.x, y, { frame: this.wreckVariant, alpha });
      }
      ctx.restore();
      return;
    }
    // 발광체는 스프라이트로 바뀌어도 광원 연출을 유지한다 (글로우는 게임 아트)
    if (this.kind === 'lantern' && Assets.has('enemy.lantern')) {
      const flick = 0.75 + Math.sin(this.t * 5.2) * 0.15;
      const g = ctx.createRadialGradient(this.x, this.y - 4, 2, this.x, this.y - 4, 30);
      g.addColorStop(0, `rgba(255, 214, 110, ${0.5 * flick * alpha})`);
      g.addColorStop(0.6, `rgba(255, 214, 110, ${0.16 * flick * alpha})`);
      g.addColorStop(1, 'rgba(255, 214, 110, 0)');
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(this.x, this.y - 4, 30, 0, 6.28); ctx.fill();
    }
    if (Sprites.draw(ctx, `enemy.${this.kind}`, this.x, this.y, {
      t: this.t, alpha, flipX: this.dirX > 0,
    })) {
      // 독니고기: 형광 눈 — 어둠에서 눈만 보이는 정체성 유지
      if (this.kind === 'viper') {
        const ex = this.x + (this.dirX > 0 ? 7 : -7);
        const g = ctx.createRadialGradient(ex, this.y - 2, 0, ex, this.y - 2, 7);
        g.addColorStop(0, `rgba(174, 247, 238, ${0.9 * alpha})`);
        g.addColorStop(1, 'rgba(174, 247, 238, 0)');
        ctx.fillStyle = g;
        ctx.beginPath(); ctx.arc(ex, this.y - 2, 7, 0, 6.28); ctx.fill();
      }
      return;
    }

    ctx.save();
    ctx.translate(this.x, this.y);
    if (this.flash > 0) { ctx.globalAlpha = 0.6; }
    const t = this.t;
    if (this.kind === 'fish') {
      // 열대어: 주황 타원 + 꼬리
      ctx.fillStyle = '#ffab5e';
      ctx.beginPath(); ctx.ellipse(0, 0, 10, 6, 0, 0, 6.28); ctx.fill();
      ctx.fillStyle = '#ff8a3d';
      const wag = Math.sin(t * 10) * 3;
      ctx.beginPath(); ctx.moveTo(8, 0); ctx.lineTo(15, -5 + wag); ctx.lineTo(15, 5 + wag); ctx.fill();
      ctx.fillStyle = '#333'; ctx.beginPath(); ctx.arc(-4, -1.5, 1.5, 0, 6.28); ctx.fill();
      ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.moveTo(-1, -5); ctx.lineTo(-1, 5); ctx.stroke();
    } else if (this.kind === 'jelly') {
      // 해파리: 분홍 반투명 갓 + 다리
      ctx.globalAlpha *= 0.85;
      ctx.fillStyle = '#ff9ed2';
      ctx.beginPath(); ctx.arc(0, 0, 11, Math.PI, 0); ctx.closePath(); ctx.fill();
      ctx.strokeStyle = '#ffc4e5'; ctx.lineWidth = 2;
      for (let i = -1; i <= 1; i++) {
        ctx.beginPath();
        ctx.moveTo(i * 5, 0);
        ctx.quadraticCurveTo(i * 5 + Math.sin(t * 4 + i) * 4, 8, i * 5 + Math.sin(t * 4 + i + 1) * 5, 15);
        ctx.stroke();
      }
      ctx.fillStyle = '#fff'; ctx.globalAlpha *= 0.9;
      ctx.beginPath(); ctx.arc(-3, -4, 1.4, 0, 6.28); ctx.fill();
      ctx.beginPath(); ctx.arc(3, -4, 1.4, 0, 6.28); ctx.fill();
    } else if (this.kind === 'lantern') {
      // 등불 해파리: 큰 갓 + 따뜻한 등불 광채 (단단 hp3)
      const glow = ctx.createRadialGradient(0, 2, 0, 0, 2, 26);
      glow.addColorStop(0, 'rgba(255,214,110,0.45)');
      glow.addColorStop(1, 'rgba(255,214,110,0)');
      ctx.fillStyle = glow;
      ctx.beginPath(); ctx.arc(0, 2, 26, 0, 6.28); ctx.fill();
      ctx.globalAlpha *= 0.9;
      ctx.fillStyle = '#c9a3ff';
      ctx.beginPath(); ctx.arc(0, 0, 14, Math.PI, 0); ctx.closePath(); ctx.fill();
      ctx.strokeStyle = '#e2ccff'; ctx.lineWidth = 2;
      for (let i = -1; i <= 1; i++) {
        ctx.beginPath();
        ctx.moveTo(i * 6, 0);
        ctx.quadraticCurveTo(i * 6 + Math.sin(t * 3 + i) * 5, 10, i * 6 + Math.sin(t * 3 + i + 1) * 6, 19);
        ctx.stroke();
      }
      // 매달린 등불
      ctx.fillStyle = '#ffd66e';
      ctx.beginPath(); ctx.arc(0, 10, 4, 0, 6.28); ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,0.5)'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, 6); ctx.stroke();
      // 눈 (졸린)
      ctx.strokeStyle = '#5c4a7a'; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.moveTo(-6, -5); ctx.lineTo(-2, -5); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(2, -5); ctx.lineTo(6, -5); ctx.stroke();
      // 단단함 금 표시
      if (this.hp < this.maxHp) {
        ctx.strokeStyle = 'rgba(255,255,255,0.5)'; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(-4, -9); ctx.lineTo(3, -3); ctx.stroke();
      }
    } else if (this.kind === 'ray') {
      // 가오리: 넓은 남색 삼각 날개
      const flap = Math.sin(t * 5) * 4;
      ctx.fillStyle = '#7189d8';
      ctx.beginPath();
      ctx.moveTo(-14, 0);
      ctx.quadraticCurveTo(2, -14 - flap, 16, -3);
      ctx.quadraticCurveTo(6, 0, 16, 3);
      ctx.quadraticCurveTo(2, 14 + flap, -14, 0);
      ctx.fill();
      ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(-8, -2, 1.6, 0, 6.28); ctx.fill();
      // HP 단단함 표시 (금)
      if (this.maxHp > 1 && this.hp < this.maxHp) {
        ctx.strokeStyle = 'rgba(255,255,255,0.5)'; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(-4, -6); ctx.lineTo(2, 4); ctx.stroke();
      }
    } else if (this.kind === 'ghost') {
      // 유령 물고기: 창백한 반투명, 꼬리가 안개처럼 흩어짐
      ctx.globalAlpha *= this.solid ? 0.9 : 0.25;
      const bob = Math.sin(t * 3) * 2;
      ctx.fillStyle = '#d8f4ec';
      ctx.beginPath(); ctx.ellipse(0, bob, 10, 7, 0, 0, 6.28); ctx.fill();
      // 안개 꼬리 (물결)
      ctx.beginPath();
      ctx.moveTo(7, bob - 6);
      ctx.quadraticCurveTo(14, bob - 3 + Math.sin(t * 5) * 3, 12, bob);
      ctx.quadraticCurveTo(17, bob + 2 + Math.sin(t * 5 + 1) * 3, 13, bob + 4);
      ctx.quadraticCurveTo(10, bob + 6, 7, bob + 6);
      ctx.fill();
      // 눈 (동그란 유령 눈)
      ctx.fillStyle = '#3a5a54';
      ctx.beginPath(); ctx.arc(-4, bob - 1.5, 2, 0, 6.28); ctx.fill();
      ctx.beginPath(); ctx.arc(1.5, bob - 1.5, 2, 0, 6.28); ctx.fill();
      // 입 (부우~)
      ctx.beginPath(); ctx.arc(-1.5, bob + 2.5, 1.4, 0, 6.28); ctx.fill();
    } else if (this.kind === 'wreck') {
      // 난파선 잔해: 낡은 선체 판자 기둥 (side: top/bot)
      const hw = this.wreckW / 2, hh = this.wreckH / 2;
      ctx.fillStyle = '#3a2e26';
      ctx.strokeStyle = '#241c16'; ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.roundRect(-hw, -hh, this.wreckW, this.wreckH, 8);
      ctx.fill(); ctx.stroke();
      // 판자 무늬
      ctx.strokeStyle = 'rgba(90,70,55,0.7)'; ctx.lineWidth = 2;
      for (let yy = -hh + 14; yy < hh - 6; yy += 18) {
        ctx.beginPath(); ctx.moveTo(-hw + 5, yy); ctx.lineTo(hw - 5, yy + 2); ctx.stroke();
      }
      // 부러진 끝 (뾰족)
      const tipY = this.side === 'top' ? hh : -hh;
      ctx.fillStyle = '#3a2e26';
      ctx.beginPath();
      ctx.moveTo(-hw, tipY);
      ctx.lineTo(-hw * 0.3, tipY + (this.side === 'top' ? 16 : -16));
      ctx.lineTo(hw * 0.2, tipY + (this.side === 'top' ? 6 : -6));
      ctx.lineTo(hw, tipY);
      ctx.fill();
      // 따개비
      ctx.fillStyle = 'rgba(200,190,170,0.5)';
      ctx.beginPath(); ctx.arc(-hw + 8, -hh * 0.3, 3, 0, 6.28); ctx.fill();
      ctx.beginPath(); ctx.arc(hw - 10, hh * 0.4, 2.5, 0, 6.28); ctx.fill();
    } else if (this.kind === 'viper') {
      // 심해 독니고기: 어두운 몸 + 형광 눈 (어둠 속에선 눈만 번뜩임)
      const dir = Math.atan2(this.vy ?? 0, this.vx ?? -1);
      ctx.rotate(dir + Math.PI); // 머리가 진행 방향
      ctx.fillStyle = '#2a3450';
      ctx.beginPath(); ctx.ellipse(0, 0, 14, 5.5, 0, 0, 6.28); ctx.fill();
      const wag = Math.sin(t * 9) * 3;
      ctx.beginPath(); ctx.moveTo(11, 0); ctx.lineTo(19, -4 + wag); ctx.lineTo(19, 4 + wag); ctx.fill();
      // 이빨 (지그재그 흰 선)
      ctx.strokeStyle = 'rgba(255,255,255,0.75)'; ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(-13, 1);
      for (let i = 0; i < 4; i++) ctx.lineTo(-12 + i * 2.6, i % 2 === 0 ? 3.5 : 1);
      ctx.stroke();
      // 형광 눈
      ctx.fillStyle = '#7ef7e8';
      ctx.beginPath(); ctx.arc(-7, -2.5, 2.1, 0, 6.28); ctx.fill();
      ctx.fillStyle = 'rgba(126,247,232,0.35)';
      ctx.beginPath(); ctx.arc(-7, -2.5, 4.5, 0, 6.28); ctx.fill();
    } else if (this.kind === 'big') {
      // 대물: 크고 튼튼한 심통 그루퍼 — 미니보스급, 링 탄막 살포
      const hurt = this.hp / this.maxHp;
      const breathe = 1 + Math.sin(t * 2.5) * 0.03;
      // 꼬리
      ctx.fillStyle = '#a34e42';
      const wag = Math.sin(t * 5) * 5;
      ctx.beginPath(); ctx.moveTo(20, 0); ctx.lineTo(36, -12 + wag); ctx.lineTo(36, 12 + wag); ctx.fill();
      // 몸통
      const bg = ctx.createRadialGradient(-8, -6, 4, 0, 0, 28);
      bg.addColorStop(0, '#d98a6a');
      bg.addColorStop(1, '#b05a48');
      ctx.fillStyle = bg;
      ctx.beginPath(); ctx.ellipse(0, 0, 26 * breathe, 18 * breathe, 0, 0, 6.28); ctx.fill();
      // 배
      ctx.fillStyle = 'rgba(255,230,200,0.4)';
      ctx.beginPath(); ctx.ellipse(-2, 7, 18, 8, 0, 0, 6.28); ctx.fill();
      // 등지느러미 (가시)
      ctx.strokeStyle = '#8a3e34'; ctx.lineWidth = 2.5;
      for (let i = -2; i <= 2; i++) {
        ctx.beginPath();
        ctx.moveTo(i * 7, -15);
        ctx.lineTo(i * 7 + 2, -22 - Math.abs(i));
        ctx.stroke();
      }
      // 두꺼운 입술 (심통)
      ctx.fillStyle = '#e8a58a';
      ctx.beginPath(); ctx.ellipse(-22, 4, 5, 7, -0.2, 0, 6.28); ctx.fill();
      // 눈 + 찌푸린 눈썹
      ctx.fillStyle = '#fff';
      ctx.beginPath(); ctx.arc(-14, -6, 4.5, 0, 6.28); ctx.fill();
      ctx.fillStyle = '#333';
      ctx.beginPath(); ctx.arc(-15, -5.5, 2, 0, 6.28); ctx.fill();
      ctx.strokeStyle = '#5c2e26'; ctx.lineWidth = 2.5;
      ctx.beginPath(); ctx.moveTo(-20, -13); ctx.lineTo(-10, -10); ctx.stroke();
      // 피해 금
      if (hurt < 0.66) {
        ctx.strokeStyle = 'rgba(255,255,255,0.55)'; ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.moveTo(4, -12); ctx.lineTo(9, -2); ctx.lineTo(5, 6); ctx.stroke();
      }
      if (hurt < 0.33) {
        ctx.strokeStyle = 'rgba(255,255,255,0.55)';
        ctx.beginPath(); ctx.moveTo(-6, 10); ctx.lineTo(-1, 3); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(14, 4); ctx.lineTo(18, 11); ctx.stroke();
      }
    } else if (this.kind === 'turret') {
      // 산호 포대: 분홍 산호 + 구멍
      ctx.fillStyle = '#ff8fa3';
      ctx.beginPath(); ctx.arc(0, 4, 13, Math.PI, 0); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#e8637e';
      ctx.beginPath(); ctx.arc(-6, -4, 5, 0, 6.28); ctx.fill();
      ctx.beginPath(); ctx.arc(6, -5, 4, 0, 6.28); ctx.fill();
      ctx.fillStyle = '#5c2438';
      ctx.beginPath(); ctx.arc(0, -2, 3.5, 0, 6.28); ctx.fill();
    }
    ctx.restore();
  }
}
