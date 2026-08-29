// ============================================================
// map.js — 항해도(스테이지 셀렉트) + 세이브 섬 상점 (GDD 4장, 5.2)
// 별빛 길이 집까지 이어지는 태평양 지도. 클리어할수록 길이 밝아진다.
// ============================================================
const MapUI = {
  shopOpen: false,
  toast: null, toastT: 0,
  sel: 0,           // 키보드로 선택된 해역
  diffSel: 0,       // 선택된 난이도
  shopCursor: 0,    // 상점 키보드 커서

  // 해역별 난이도 해금: 그 해역을 d-1 난이도로 클리어해야 d 해금
  maxDiffFor(stageIdx) {
    if (Game.debug) return DIFFS.length - 1;
    const lv = Meta.clearedLevel(STAGES[stageIdx].id);
    return Math.min(DIFFS.length - 1, lv + 1);
  },
  diffChip(i) { return { x: 755 + i * 62, y: 446, w: 58, h: 26 }; },

  // 별빛 길 노드 (스테이지 1~7 + 집)
  NODES: [
    { x: 150, y: 435, name: '산호 초입' },
    { x: 255, y: 390, name: '해파리 초원' },
    { x: 355, y: 335, name: '거북이 고속도로' },
    { x: 450, y: 295, name: '심해 협곡' },
    { x: 545, y: 250, name: '난파선 묘지' },
    { x: 640, y: 210, name: '폭풍 수면' },
    { x: 735, y: 165, name: '용궁 앞바다' },
  ],
  HOME: { x: 845, y: 105 },

  BTN: {
    shop: { x: 555, y: 484, w: 155, h: 42 },
    go:   { x: 755, y: 480, w: 180, h: 48 },
    close:{ x: 838, y: 52,  w: 34,  h: 26 },
  },
  dolphinSlot(i) { return { x: 118 + i * 82, y: 478, w: 74, h: 52 }; },
  // 봄 선택 슬롯 (8종, 항해도 우측 세로열)
  bombSlot(i) { return { x: 118 + i * 36, y: 444, w: 33, h: 26 }; },
  // 볼륨 컨트롤 (우상단) — 클릭하면 0 → 30 → 60 → 100% 순환
  volBtn(i) { return { x: CFG.W - 176 + i * 88, y: 12, w: 80, h: 22 }; },

  showToast(msg, ok) { this.toast = { msg, ok }; this.toastT = 1.8; },

  // 출격 가능한 해역 수 (직전 해역 클리어 시 다음 해역 해금)
  unlockedCount() {
    if (Game.debug) return STAGES.length; // 디버그: 전 해역 해금 (세이브는 안 건드림)
    let c = 1;
    for (let i = 1; i < STAGES.length; i++) {
      if (Meta.clearedLevel(STAGES[i - 1].id) >= 0) c = i + 1;
    }
    return c;
  },
  clearedCount() {
    let c = 0;
    for (let i = 0; i < STAGES.length; i++) if (Meta.clearedLevel(STAGES[i].id) >= 0) c++;
    return c;
  },

  shopRows() {
    const rows = [];
    const left = SHOP_ITEMS.filter(i => !i.dolphin);
    const right = SHOP_ITEMS.filter(i => i.dolphin);
    left.forEach((item, i)  => rows.push({ item, x: 95,  y: 122 + i * 48, w: 380, h: 44 }));
    right.forEach((item, i) => rows.push({ item, x: 495, y: 122 + i * 40, w: 380, h: 36 }));
    return rows;
  },

  inRect(p, r) { return p.x >= r.x && p.x <= r.x + r.w && p.y >= r.y && p.y <= r.y + r.h; },

  // 돌고래 슬롯 순환 (잠긴 것 스킵, null=혼자 항상 가능)
  cycleDolphin() {
    const order = [null, 'homing', 'burst', 'pierce'];
    let i = order.indexOf(Meta.data.selected);
    for (let step = 0; step < 4; step++) {
      i = (i + 1) % 4;
      const t = order[i];
      if (t === null || Meta.data.dolphinLv[t] > 0) {
        Meta.data.selected = t;
        Meta.save();
        return;
      }
    }
  },

  // 해금된 봄만 순환
  cycleBomb() {
    const cur = Meta.data.bombSel || 'sonar';
    let i = BOMB_ORDER.indexOf(cur);
    for (let step = 0; step < BOMB_ORDER.length; step++) {
      i = (i + 1) % BOMB_ORDER.length;
      if (bombUnlocked(BOMB_ORDER[i])) {
        Meta.data.bombSel = BOMB_ORDER[i];
        Meta.save();
        Sound.sfx('uiMove');
        return;
      }
    }
  },

  update(dt, game) {
    if (this.toastT > 0) this.toastT -= dt;
    this.sel = Math.min(this.sel, this.unlockedCount() - 1);
    this.diffSel = Math.min(this.diffSel, this.maxDiffFor(this.sel));
    const clicks = Input.consumeClicks();
    Input.consumeAny(); Input.consumeBomb();

    // ---- 키보드 조작 ----
    for (const k of Input.consumeKeyPresses()) {
      if (this.shopOpen) {
        const rows = this.shopRows();
        const leftN = rows.filter(r => !r.item.dolphin).length;
        if (k === 'escape' || k === 'x') this.shopOpen = false;
        else if (k === 'arrowup' || k === 'w') this.shopCursor = (this.shopCursor + rows.length - 1) % rows.length;
        else if (k === 'arrowdown' || k === 's') this.shopCursor = (this.shopCursor + 1) % rows.length;
        else if (k === 'arrowleft' || k === 'arrowright' || k === 'a' || k === 'd') {
          // 좌우 = 컬럼 전환 (상대 위치 유지)
          this.shopCursor = this.shopCursor < leftN
            ? leftN + Math.min(this.shopCursor, rows.length - leftN - 1)
            : Math.min(this.shopCursor - leftN, leftN - 1);
        }
        else if (k === 'enter' || k === 'z' || k === ' ') {
          const row = rows[this.shopCursor];
          const r = Meta.buy(row.item);
          Sound.sfx(r.ok ? 'buy' : 'deny');
          this.showToast(r.ok ? `${row.item.name} 구매!` : `${r.why}`, r.ok);
        }
      } else {
        if (k === 'arrowleft' || k === 'a') { this.sel = Math.max(0, this.sel - 1); Sound.sfx('uiMove'); }
        else if (k === 'arrowright' || k === 'd') { this.sel = Math.min(this.unlockedCount() - 1, this.sel + 1); Sound.sfx('uiMove'); }
        else if (k === 'arrowup' || k === 'w') this.diffSel = Math.min(this.maxDiffFor(this.sel), this.diffSel + 1);
        else if (k === 'arrowdown') this.diffSel = Math.max(0, this.diffSel - 1);
        else if (k === 'enter' || k === 'z') { Sound.sfx('uiSelect'); game.launchStage(this.sel, this.diffSel); return; }
        else if (k === 's' || k === 'x') { this.shopOpen = true; this.shopCursor = 0; }
        else if (k === 'c') this.cycleDolphin();
        else if (k === 'b') this.cycleBomb();
      }
    }

    for (const p of clicks) {
      if (this.shopOpen) {
        if (this.inRect(p, this.BTN.close)) { this.shopOpen = false; continue; }
        for (const row of this.shopRows()) {
          if (this.inRect(p, row)) {
            const r = Meta.buy(row.item);
            Sound.sfx(r.ok ? 'buy' : 'deny');
            this.showToast(r.ok ? `${row.item.name} 구매!` : `${r.why}`, r.ok);
          }
        }
        continue;
      }
      // 돌고래 슬롯 (0 = 없음, 1~3 = 종)
      const types = [null, 'homing', 'burst', 'pierce'];
      for (let i = 0; i < 4; i++) {
        if (this.inRect(p, this.dolphinSlot(i))) {
          const t = types[i];
          if (t === null) { Meta.data.selected = null; Meta.save(); }
          else if (Meta.data.dolphinLv[t] > 0) { Meta.data.selected = t; Meta.save(); }
          else this.showToast('세이브 섬 상점에서 해금하세요', false);
        }
      }
      // 봄 선택
      let bombHit = false;
      for (let i = 0; i < BOMB_ORDER.length; i++) {
        if (this.inRect(p, this.bombSlot(i))) {
          bombHit = true;
          const id = BOMB_ORDER[i];
          if (bombUnlocked(id)) { Meta.data.bombSel = id; Meta.save(); Sound.sfx('uiSelect'); }
          else { Sound.sfx('deny'); this.showToast('해당 보스를 잡으면 해금됩니다', false); }
        }
      }
      if (bombHit) continue;
      // 볼륨 컨트롤
      if (this.inRect(p, this.volBtn(0))) { Sound.cycleVol('bgm'); continue; }
      if (this.inRect(p, this.volBtn(1))) { Sound.cycleVol('sfx'); continue; }
      // 난이도 칩
      for (let d = 0; d < DIFFS.length; d++) {
        if (this.inRect(p, this.diffChip(d))) {
          if (d <= this.maxDiffFor(this.sel)) this.diffSel = d;
          else this.showToast(`${DIFFS[d - 1].name}로 이 해역을 클리어하면 해금`, false);
        }
      }
      if (this.inRect(p, this.BTN.shop)) { this.shopOpen = true; continue; }
      if (this.inRect(p, this.BTN.go)) { Sound.sfx('uiSelect'); game.launchStage(this.sel, this.diffSel); return; }
      // 해금된 노드 클릭 = 선택 (같은 노드 다시 클릭 = 출격)
      for (let i = 0; i < this.unlockedCount() && i < STAGES.length; i++) {
        const n = this.NODES[i];
        if ((p.x - n.x) ** 2 + (p.y - n.y) ** 2 < 30 * 30) {
          if (this.sel === i) { game.launchStage(i, this.diffSel); return; }
          this.sel = i;
          this.diffSel = Math.min(this.diffSel, this.maxDiffFor(i));
        }
      }
    }
  },

  draw(ctx, game) {
    // 바다 배경 (밝은 항해도 톤)
    const g = ctx.createLinearGradient(0, 0, 0, CFG.H);
    g.addColorStop(0, '#2a6fd0'); g.addColorStop(1, '#0d3a86');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, CFG.W, CFG.H);
    const now = performance.now() / 1000;

    ctx.save();
    ctx.textAlign = 'center';
    ctx.fillStyle = 'rgba(255,255,255,0.9)';
    ctx.font = Fonts.f(22, true);
    ctx.fillText('태평양 항해도', CFG.W / 2, 40);
    // 총점: 해역별 최고 점수 합산
    {
      const total = STAGES.reduce((a, st) => a + Meta.bestFor(st.id), 0);
      if (total > 0) {
        ctx.textAlign = 'left';
        ctx.fillStyle = '#ffe9a8'; ctx.font = Fonts.f(13, true);
        ctx.fillText(`총점 ${total.toLocaleString()}`, 20, 30);
        ctx.fillStyle = 'rgba(255,255,255,0.4)'; ctx.font = Fonts.f(11);
        ctx.fillText('해역별 최고 점수 합산', 20, 46);
      }
    }
    ctx.font = Fonts.f(12);
    ctx.fillStyle = 'rgba(255,255,255,0.55)';
    ctx.fillText('별빛 길을 따라 집으로', CFG.W / 2, 60);

    // 볼륨 컨트롤 (BGM / SE) — 4단계 막대
    [['BGM', 'bgm'], ['SE', 'sfx']].forEach(([label, key], i) => {
      const r = this.volBtn(i);
      const v = Sound.muted ? 0 : Sound.vol[key];
      ctx.fillStyle = 'rgba(255,255,255,0.07)';
      ctx.beginPath(); ctx.roundRect(r.x, r.y, r.w, r.h, 6); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.55)';
      ctx.font = Fonts.f(11); ctx.textAlign = 'left';
      ctx.fillText(label, r.x + 7, r.y + 15);
      for (let b = 0; b < 3; b++) {
        const on = v > b * 0.3 + 0.01;
        ctx.fillStyle = on ? '#7dffd8' : 'rgba(255,255,255,0.18)';
        ctx.fillRect(r.x + 38 + b * 12, r.y + 14 - b * 3, 8, 4 + b * 3);
      }
    });
    if (Sound.muted) {
      ctx.fillStyle = '#ff9e9e'; ctx.font = Fonts.f(11); ctx.textAlign = 'right';
      ctx.fillText('음소거 (M)', CFG.W - 12, 48);
    }

    // 별빛 길 (진주 점선) — 클리어한 구간은 밝게
    const pts = [...this.NODES, this.HOME];
    const litUpto = this.clearedCount(); // 클리어한 노드까지 밝음
    for (let i = 0; i < pts.length - 1; i++) {
      const a = pts[i], b = pts[i + 1];
      const segs = 6;
      for (let k = 1; k < segs; k++) {
        const x = a.x + (b.x - a.x) * k / segs;
        const y = a.y + (b.y - a.y) * k / segs;
        const lit = i < litUpto;
        const tw = lit ? 0.9 : 0.22 + Math.sin(now * 2 + i + k) * 0.06;
        ctx.fillStyle = `rgba(255, 240, 190, ${tw})`;
        ctx.beginPath(); ctx.arc(x, y, lit ? 4 : 2.5, 0, 6.28); ctx.fill();
      }
    }

    // 노드
    const unlockedN = this.unlockedCount();
    this.NODES.forEach((n, i) => {
      const unlocked = i < unlockedN && i < STAGES.length;
      const clearLv = STAGES[i] ? Meta.clearedLevel(STAGES[i].id) : -1;
      const cleared = clearLv >= 0;
      ctx.save();
      ctx.translate(n.x, n.y);
      if (unlocked) {
        const pulse = 1 + Math.sin(now * 3) * 0.08;
        // 키보드 선택 링
        if (i === this.sel) {
          ctx.strokeStyle = `rgba(255,255,255,${0.6 + Math.sin(now * 5) * 0.3})`;
          ctx.lineWidth = 2.5;
          ctx.beginPath(); ctx.arc(0, 0, 26, 0, 6.28); ctx.stroke();
        }
        // 별 노드 — 색 = 최고 클리어 난이도 (이지 청록 / 노멀 금 / 하드 빨강)
        ctx.fillStyle = cleared ? DIFFS[clearLv].color : '#ffd76e';
        ctx.strokeStyle = cleared ? '#ffffff' : '#fff3b0'; ctx.lineWidth = 2;
        this.star(ctx, 0, 0, 16 * pulse, 8 * pulse);
        ctx.fill(); ctx.stroke();
        ctx.fillStyle = '#fff';
        ctx.font = Fonts.f(13, true); ctx.textAlign = 'center';
        ctx.fillText(`${i + 1}. ${n.name}`, 0, -28);
        if (cleared) {
          // 친구가 된 보스 얼굴 (해역별 색)
          ctx.fillStyle = STAGES[i].friendColor;
          ctx.beginPath(); ctx.arc(28, -18, 9, 0, 6.28); ctx.fill();
          ctx.fillStyle = '#333';
          ctx.beginPath(); ctx.arc(25, -20, 1.3, 0, 6.28); ctx.fill();
          ctx.beginPath(); ctx.arc(31, -20, 1.3, 0, 6.28); ctx.fill();
          ctx.strokeStyle = '#333'; ctx.lineWidth = 1;
          ctx.beginPath(); ctx.arc(28, -16, 3, 0.2, Math.PI - 0.2); ctx.stroke(); // 웃음
        }
      } else {
        ctx.fillStyle = 'rgba(255,255,255,0.18)';
        ctx.beginPath(); ctx.arc(0, 0, 11, 0, 6.28); ctx.fill();
        ctx.fillStyle = 'rgba(255,255,255,0.4)';
        ctx.font = Fonts.f(12, true); ctx.textAlign = 'center';
        ctx.fillText('?', 0, 4);
      }
      ctx.restore();
    });

    // 집 (용궁 성)
    ctx.save();
    ctx.translate(this.HOME.x, this.HOME.y);
    ctx.fillStyle = '#ffcf8f';
    ctx.fillRect(-18, -8, 36, 22);
    ctx.beginPath(); ctx.moveTo(-22, -8); ctx.lineTo(0, -30); ctx.lineTo(22, -8); ctx.fill();
    ctx.fillStyle = '#ff9ec7';
    ctx.fillRect(-3, -44, 2, 14); // 깃대
    ctx.beginPath(); ctx.moveTo(-1, -44); ctx.lineTo(12, -40); ctx.lineTo(-1, -36); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    ctx.font = Fonts.f(12, true); ctx.textAlign = 'center';
    ctx.fillText('집', 0, 32);
    ctx.restore();

    // ---- 하단 바 ----
    ctx.fillStyle = 'rgba(6, 18, 55, 0.82)';
    ctx.fillRect(0, 466, CFG.W, CFG.H - 466);

    // 영구 진주 은행
    const pg = ctx.createRadialGradient(30, 500, 0, 32, 502, 9);
    pg.addColorStop(0, '#fff'); pg.addColorStop(1, '#d8b4e8');
    ctx.fillStyle = pg;
    ctx.beginPath(); ctx.arc(32, 502, 9, 0, 6.28); ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.font = Fonts.f(16, true); ctx.textAlign = 'left';
    ctx.fillText(`${Meta.data.bank}`, 48, 508);

    // 돌고래 슬롯
    const types = [null, 'homing', 'burst', 'pierce'];
    for (let i = 0; i < 4; i++) {
      const r = this.dolphinSlot(i);
      const t = types[i];
      const selected = Meta.data.selected === t;
      const unlocked = t === null || Meta.data.dolphinLv[t] > 0;
      ctx.fillStyle = selected ? 'rgba(125,255,216,0.22)' : 'rgba(255,255,255,0.07)';
      ctx.strokeStyle = selected ? '#7dffd8' : 'rgba(255,255,255,0.3)';
      ctx.lineWidth = selected ? 2 : 1;
      ctx.beginPath(); ctx.roundRect(r.x, r.y, r.w, r.h, 8); ctx.fill(); ctx.stroke();
      ctx.textAlign = 'center';
      if (t === null) {
        ctx.fillStyle = 'rgba(255,255,255,0.6)';
        ctx.font = Fonts.f(12);
        ctx.fillText('혼자', r.x + r.w / 2, r.y + 31);
      } else {
        const d = DOLPHIN_DEFS[t];
        ctx.globalAlpha = unlocked ? 1 : 0.35;
        ctx.fillStyle = d.color;
        ctx.beginPath(); ctx.ellipse(r.x + r.w / 2, r.y + 20, 13, 7, -0.15, 0, 6.28); ctx.fill();
        ctx.fillStyle = unlocked ? '#fff' : 'rgba(255,255,255,0.5)';
        ctx.font = Fonts.f(11);
        ctx.fillText(unlocked ? `${d.label} Lv${Meta.data.dolphinLv[t]}` : '잠김', r.x + r.w / 2, r.y + 44);
        ctx.globalAlpha = 1;
      }
    }

    // 버튼들
    this.button(ctx, this.BTN.shop, '세이브 섬 (상점)', '#ffb0c8', false);
    this.button(ctx, this.BTN.go, `출격!  ▶`, DIFFS[this.diffSel].color, true);

    // 봄 슬롯 (보스 격파로 해금)
    {
      const sel = Meta.data.bombSel || 'sonar';
      ctx.fillStyle = 'rgba(255,255,255,0.45)';
      ctx.font = Fonts.f(11); ctx.textAlign = 'left';
      ctx.fillText('봄 (B)', 70, 462);
      BOMB_ORDER.forEach((id, i) => {
        const r = this.bombSlot(i);
        const def = BOMB_DEFS[id];
        const open = bombUnlocked(id);
        const on = sel === id;
        ctx.fillStyle = on ? 'rgba(255,255,255,0.2)' : 'rgba(255,255,255,0.06)';
        ctx.strokeStyle = on ? def.color : (open ? 'rgba(255,255,255,0.3)' : 'rgba(255,255,255,0.12)');
        ctx.lineWidth = on ? 2 : 1;
        ctx.beginPath(); ctx.roundRect(r.x, r.y, r.w, r.h, 6); ctx.fill(); ctx.stroke();
        ctx.textAlign = 'center';
        if (open) {
          // 봄 아이콘: 색 원 (선택된 것은 링 추가)
          ctx.fillStyle = def.color;
          ctx.beginPath(); ctx.arc(r.x + r.w / 2, r.y + 13, on ? 7 : 5.5, 0, 6.28); ctx.fill();
          if (on) {
            ctx.strokeStyle = def.color; ctx.lineWidth = 1.5;
            ctx.beginPath(); ctx.arc(r.x + r.w / 2, r.y + 13, 11, 0, 6.28); ctx.stroke();
          }
        } else {
          ctx.fillStyle = 'rgba(255,255,255,0.25)';
          ctx.font = Fonts.f(11);
          ctx.fillText('🔒', r.x + r.w / 2, r.y + 18);
        }
      });
      // 선택된 봄의 이름·설명
      const d = BOMB_DEFS[sel];
      ctx.textAlign = 'left';
      ctx.fillStyle = d.color; ctx.font = Fonts.f(12, true);
      ctx.fillText(d.name, 420, 456);
      ctx.fillStyle = 'rgba(255,255,255,0.5)'; ctx.font = Fonts.f(11);
      ctx.fillText(d.desc, 420, 470);
    }

    // 난이도 칩 (출격 버튼 위)
    const maxD = this.maxDiffFor(this.sel);
    for (let d = 0; d < DIFFS.length; d++) {
      const r = this.diffChip(d);
      const open = d <= maxD;
      const selD = d === this.diffSel;
      ctx.fillStyle = selD ? 'rgba(255,255,255,0.18)' : 'rgba(255,255,255,0.06)';
      ctx.strokeStyle = open ? (selD ? DIFFS[d].color : 'rgba(255,255,255,0.35)') : 'rgba(255,255,255,0.15)';
      ctx.lineWidth = selD ? 2 : 1;
      ctx.beginPath(); ctx.roundRect(r.x, r.y, r.w, r.h, 7); ctx.fill(); ctx.stroke();
      ctx.fillStyle = open ? (selD ? DIFFS[d].color : 'rgba(255,255,255,0.6)') : 'rgba(255,255,255,0.25)';
      ctx.font = Fonts.f(12, true); ctx.textAlign = 'center';
      ctx.fillText(open ? DIFFS[d].name : '🔒', r.x + r.w / 2, r.y + 18);
    }

    // 키보드 조작 힌트
    ctx.fillStyle = 'rgba(255,255,255,0.45)';
    ctx.font = Fonts.f(11);
    ctx.textAlign = 'center';
    ctx.fillText('←→ 해역 · ↑↓ 난이도 · Enter 출격 · S 상점 · C 돌고래 · B 봄', CFG.W / 2, 430);

    if (this.shopOpen) this.drawShop(ctx);

    // 토스트
    if (this.toastT > 0 && this.toast) {
      ctx.globalAlpha = Math.min(1, this.toastT / 0.4);
      ctx.fillStyle = this.toast.ok ? '#7dffd8' : '#ff9e9e';
      ctx.font = Fonts.f(15, true); ctx.textAlign = 'center';
      ctx.fillText(this.toast.msg, CFG.W / 2, 448);
      ctx.globalAlpha = 1;
    }
    ctx.restore();
  },

  button(ctx, r, label, color, big) {
    ctx.fillStyle = 'rgba(255,255,255,0.08)';
    ctx.strokeStyle = color; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.roundRect(r.x, r.y, r.w, r.h, 10); ctx.fill(); ctx.stroke();
    ctx.fillStyle = color;
    ctx.font = Fonts.f(big ? 18 : 14, true); ctx.textAlign = 'center';
    ctx.fillText(label, r.x + r.w / 2, r.y + r.h / 2 + 6);
  },

  star(ctx, cx, cy, outer, inner) {
    ctx.beginPath();
    for (let i = 0; i < 10; i++) {
      const r = i % 2 === 0 ? outer : inner;
      const a = -Math.PI / 2 + i * Math.PI / 5;
      const x = cx + Math.cos(a) * r, y = cy + Math.sin(a) * r;
      i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    }
    ctx.closePath();
  },

  drawShop(ctx) {
    ctx.save();
    ctx.fillStyle = 'rgba(4, 10, 35, 0.88)';
    ctx.beginPath(); ctx.roundRect(70, 34, 820, 460, 14); ctx.fill();
    ctx.strokeStyle = 'rgba(255,176,200,0.5)'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.roundRect(70, 34, 820, 460, 14); ctx.stroke();

    ctx.textAlign = 'center';
    ctx.fillStyle = '#ffb0c8';
    ctx.font = Fonts.f(19, true);
    ctx.fillText('🏝 세이브 섬 상점', CFG.W / 2, 66);
    ctx.font = Fonts.f(12);
    ctx.fillStyle = 'rgba(255,255,255,0.55)';
    ctx.fillText(`보유 진주: ${Meta.data.bank} · 기본샷은 못 키워요 — 살아남는 법과 돌고래를 팔죠`, CFG.W / 2, 86);
    ctx.fillStyle = 'rgba(255,255,255,0.4)';
    ctx.font = Fonts.f(11);
    ctx.fillText('↑↓ 이동 · ←→ 칸 전환 · Enter 구매 · Esc 닫기', CFG.W / 2, 486);

    // 닫기
    const c = this.BTN.close;
    ctx.fillStyle = 'rgba(255,255,255,0.12)';
    ctx.beginPath(); ctx.roundRect(c.x, c.y, c.w, c.h, 6); ctx.fill();
    ctx.fillStyle = '#fff'; ctx.font = Fonts.f(13, true);
    ctx.fillText('✕', c.x + c.w / 2, c.y + 18);

    // 컬럼 헤더
    ctx.textAlign = 'left';
    ctx.fillStyle = '#7dffd8'; ctx.font = Fonts.f(14, true);
    ctx.fillText('몸 · 조개폰 (구제책)', 95, 114);
    ctx.fillStyle = '#5aa9ff';
    ctx.fillText('돌고래 (빌드)', 495, 114);

    const rows = this.shopRows();
    for (let ri = 0; ri < rows.length; ri++) {
      const row = rows[ri];
      const it = row.item;
      const owned = Meta.has(it.id);
      const can = Meta.canBuy(it);
      ctx.fillStyle = owned ? 'rgba(125,255,216,0.10)' : can.ok ? 'rgba(255,255,255,0.09)' : 'rgba(255,255,255,0.03)';
      ctx.beginPath(); ctx.roundRect(row.x, row.y, row.w, row.h, 7); ctx.fill();
      // 키보드 커서
      if (ri === this.shopCursor) {
        ctx.strokeStyle = '#ffe9a8'; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.roundRect(row.x, row.y, row.w, row.h, 7); ctx.stroke();
      }

      ctx.fillStyle = owned ? '#7dffd8' : can.ok ? '#fff' : 'rgba(255,255,255,0.45)';
      ctx.font = Fonts.f(13, true); ctx.textAlign = 'left';
      ctx.fillText(it.name, row.x + 10, row.y + 16);
      ctx.font = Fonts.f(11);
      ctx.fillStyle = 'rgba(255,255,255,0.5)';
      ctx.fillText(it.desc, row.x + 10, row.y + row.h - 7);

      ctx.textAlign = 'right';
      if (owned) {
        ctx.fillStyle = '#7dffd8'; ctx.font = Fonts.f(12, true);
        ctx.fillText('보유', row.x + row.w - 10, row.y + 18);
      } else {
        ctx.fillStyle = can.ok ? '#ffe9a8' : 'rgba(255,233,168,0.4)';
        ctx.font = Fonts.f(12, true);
        ctx.fillText(`◉ ${it.cost}`, row.x + row.w - 10, row.y + 18);
      }
    }
    ctx.restore();
  },
};
