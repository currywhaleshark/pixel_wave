// ============================================================
// dolphin.js — 옵션 돌고래 3종 (GDD 6장)
// 유도(homing) / 폭발(burst) / 관통(pierce), Lv1~3
// 공통 기능: 보스 발사 예고 "힌트!" (Lv1부터, 종류 무관)
// ============================================================
class Dolphin {
  constructor(type, lv) {
    this.type = type;
    this.lv = lv;
    this.def = DOLPHIN_DEFS[type];
    this.x = 0; this.y = 0;
    this.t = Math.random() * 6.28;
    this.fireT = 0.6;
    this.waveT = 4;      // 관통 Lv3: 더블 파도 주기
    this.slowCd = 0;     // 유도 Lv3: 자동 슬로우 쿨다운
  }

  update(dt, game) {
    const p = game.player;
    this.t += dt;
    if (this.slowCd > 0) this.slowCd -= dt;

    // 플레이어 뒤를 둥실둥실 따라다님
    const tx = p.x - 36, ty = p.y - 22 + Math.sin(this.t * 3) * 7;
    this.x += (tx - this.x) * Math.min(1, dt * 6);
    this.y += (ty - this.y) * Math.min(1, dt * 6);

    if (p.bubble > 0) return;

    // --- 서브샷 ---
    this.fireT -= dt;
    if (this.fireT <= 0) {
      if (this.type === 'homing') {
        // GDD 6장: 유도 = 단발 화력 최저. 조준 불필요의 대가는 낮은 DPS
        this.fireT = this.lv >= 2 ? 1.0 : 0.9;
        const shots = this.lv >= 2 ? 2 : 1;
        for (let i = 0; i < shots; i++) {
          const a = -0.4 + i * 0.8;
          game.shots.push({
            kind: 'homing', x: this.x, y: this.y,
            vx: Math.cos(a) * 330, vy: Math.sin(a) * 330,
            spd: 330, turn: 5.5, dmg: 1, r: 5, pierce: 0, t: 0,
          });
        }
      } else if (this.type === 'burst') {
        // 기포탄은 **맞으면 터진다**. 예전엔 0.65초 신관이 있어 182px만 날고
        // 공중에서 자폭했다 — 신관을 없애 명중할 때까지 날아간다.
        this.fireT = this.lv >= 2 ? 0.7 : 0.85;
        game.shots.push({
          kind: 'bomb', x: this.x, y: this.y,
          vx: 340, vy: -14,
          dmg: this.lv >= 2 ? 3 : 2,
          radius: this.lv >= 2 ? 90 : 60,
          clearBullets: this.lv >= 3,
          r: 7, t: 0,
        });
      }
      // pierce는 단발이 아니라 아래의 지속 빔 사이클을 쓴다
    }

    // --- 관통: 지속 조사 빔 (일정 시간 켜졌다 잠시 꺼짐) ---
    if (this.type === 'pierce') this.updateBeam(dt, game);

    // 관통 Lv3 고유기: 주기적 더블 파도
    if (this.type === 'pierce' && this.lv >= 3) {
      this.waveT -= dt;
      if (this.waveT <= 0) {
        this.waveT = 4;
        game.shots.push({
          kind: 'beam', x: this.x + 10, y: this.y,
          vx: 420, vy: 0, dmg: 8, pierce: 999, r: 13, big: true, t: 0,
        });   // 굵은 빔 자체가 보이므로 문자 안내는 생략
      }
    }

    // 유도 Lv3 고유기: 피격 직전 자동 슬로우 (돌고래가 위험을 먼저 감지)
    if (this.type === 'homing' && this.lv >= 3 && this.slowCd <= 0 && p.invuln <= 0) {
      for (const b of game.ebullets) {
        const dx = p.x - b.x, dy = p.y - b.y;
        const d2 = dx * dx + dy * dy;
        // 가까이 + 접근 중일 때만
        if (d2 < 52 * 52 && (dx * b.vx + dy * b.vy) > 0) {
          game.slowT = 0.35;
          this.slowCd = 2.5;
          game.addFx(this.x, this.y, '#5aa9ff', 6);
          break;
        }
      }
    }
  }

  // 지속 빔: 예열 → 조사 → 냉각 순환. 조사 중엔 일정 간격으로 피해를 준다.
  // (단발 빔을 뿌리는 것보다 "겨눠서 태우는" 조작감이 관통 컨셉에 맞다)
  beamSpec() {
    return [
      { warm: 0.25, on: 1.4, off: 1.2, tick: 0.15, dmg: 1, h: 5 },   // Lv1
      { warm: 0.22, on: 1.8, off: 1.0, tick: 0.12, dmg: 1, h: 6 },   // Lv2
      { warm: 0.2,  on: 2.2, off: 0.9, tick: 0.10, dmg: 1, h: 7 },   // Lv3
    ][Math.max(0, Math.min(2, this.lv - 1))];
  }

  updateBeam(dt, game) {
    const S = this.beamSpec();
    if (this.beamPhase === undefined) { this.beamPhase = 'off'; this.beamT = 0.4; this.beamTick = 0; }
    this.beamT -= dt;
    if (this.beamT <= 0) {
      if (this.beamPhase === 'off') { this.beamPhase = 'warm'; this.beamT = S.warm; }
      else if (this.beamPhase === 'warm') { this.beamPhase = 'on'; this.beamT = S.on; this.beamTick = 0; }
      else { this.beamPhase = 'off'; this.beamT = S.off; }
    }
    if (this.beamPhase !== 'on') return;

    // 조사 중 피해 (틱 간격 — 매 프레임 때리면 화력이 폭주한다)
    this.beamTick -= dt;
    if (this.beamTick > 0) return;
    this.beamTick = S.tick;
    const y = this.y, half = S.h + 4;
    for (const e of game.enemies) {
      if (typeof e.isHittable === 'function' && !e.isHittable()) continue;
      const er = (typeof KIND_R !== 'undefined' ? (KIND_R[e.kind] ?? 10) : 10);
      if (e.x >= this.x - 10 && Math.abs(e.y - y) < half + er) e.takeDamage(S.dmg, game);
    }
    const b = game.boss;
    if (b && !b.dead && b.phase > 0 && b.hittable !== false) {
      const br = 44 * (b.scale ?? 1);
      if (b.x >= this.x - 10 && Math.abs(b.y - y) < half + br) b.takeDamage(S.dmg);
    }
  }

  drawBeam(ctx) {
    if (this.type !== 'pierce' || this.beamPhase === 'off' || this.beamPhase === undefined) return;
    const S = this.beamSpec();
    const warming = this.beamPhase === 'warm';
    const x0 = this.x + 10, y = this.y;
    const h = warming ? 2 : S.h * (1 + Math.sin(performance.now() / 40) * 0.12);
    ctx.save();
    // 바깥 광채
    const g = ctx.createLinearGradient(0, y - h * 3, 0, y + h * 3);
    g.addColorStop(0, 'rgba(207,216,232,0)');
    g.addColorStop(0.5, `rgba(207,216,232,${warming ? 0.18 : 0.4})`);
    g.addColorStop(1, 'rgba(207,216,232,0)');
    ctx.fillStyle = g;
    ctx.fillRect(x0, y - h * 3, CFG.W - x0, h * 6);
    // 코어
    ctx.fillStyle = warming ? 'rgba(238,244,255,0.55)' : '#eef4ff';
    ctx.fillRect(x0, y - h / 2, CFG.W - x0, h);
    // 발사구 반짝
    ctx.fillStyle = '#ffffff';
    ctx.beginPath(); ctx.arc(x0, y, warming ? 3 : 6, 0, 6.28); ctx.fill();
    ctx.restore();
  }

  draw(ctx, game) {
    this.drawBeam(ctx);
    // 스프라이트 우선 (힌트 말풍선은 아래 공통 처리)
    if (Sprites.draw(ctx, `dolphin.${this.type}`, this.x, this.y, { t: this.t })) {
      this.drawHint(ctx, game);
      return;
    }
    ctx.save();
    ctx.translate(this.x, this.y);
    const t = this.t;
    // 임시 돌고래: 몸통 + 등지느러미 + 꼬리
    ctx.fillStyle = this.def.color;
    ctx.beginPath(); ctx.ellipse(0, 0, 12, 6, -0.15, 0, 6.28); ctx.fill();
    ctx.beginPath(); ctx.moveTo(-2, -5); ctx.lineTo(2, -10); ctx.lineTo(5, -5); ctx.fill(); // 등지느러미
    const wag = Math.sin(t * 9) * 3;
    ctx.beginPath(); ctx.moveTo(-10, 0); ctx.lineTo(-17, -4 + wag); ctx.lineTo(-17, 4 + wag); ctx.fill(); // 꼬리
    ctx.fillStyle = '#fff';
    ctx.beginPath(); ctx.arc(6, -2, 1.4, 0, 6.28); ctx.fill(); // 눈
    ctx.fillStyle = 'rgba(255,255,255,0.35)';
    ctx.beginPath(); ctx.ellipse(2, 2.5, 8, 2.5, -0.1, 0, 6.28); ctx.fill(); // 배

    ctx.restore();
    this.drawHint(ctx, game);
  }

  // 공통 기능: 보스 발사 예고에 맞춰 "힌트!" 말풍선
  drawHint(ctx, game) {
    if (!(game.boss && !game.boss.dead && game.boss.telegraph > 0)) return;
    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.fillStyle = 'rgba(255,255,255,0.95)';
    ctx.strokeStyle = '#5aa9ff'; ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.roundRect(-24, -38, 48, 18, 8);
    ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#2b5bb8';
    ctx.font = Fonts.f(11, true); ctx.textAlign = 'center';
    ctx.fillText('힌트!', 0, -25);
    ctx.restore();
  }
}
