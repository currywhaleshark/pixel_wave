// ============================================================
// map.js — 항해도(스테이지 셀렉트) + 세이브 섬 상점 (GDD 4장, 5.2)
// 별빛 길이 집까지 이어지는 태평양 지도. 클리어할수록 길이 밝아진다.
// ============================================================
const MapUI = {
  shopOpen: false,
  toast: null, toastT: 0,
  sel: 0,           // 키보드로 선택된 해역
  diffSel: 0,       // 선택된 난이도 (출격 준비 창에서 결정, Meta에 기억)
  shopCursor: 0,    // 상점 키보드 커서
  launchOpen: false,             // 출격 준비 창
  cursor: { row: 3, col: 0 },    // 창 안 마커 — 열릴 때 출격 버튼(3행)에 붙는다

  // 해역별 난이도 해금: 그 해역을 d-1 난이도로 클리어해야 d 해금
  maxDiffFor(stageIdx) {
    if (Game.debug) return DIFFS.length - 1;
    const lv = Meta.clearedLevel(STAGES[stageIdx].id);
    return Math.min(DIFFS.length - 1, lv + 1);
  },

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
    shop: { x: 402, y: 482, w: 156, h: 44 },
    close:{ x: 838, y: 52,  w: 34,  h: 26 },
  },
  // ---- 출격 준비 창 지오메트리 ----
  LP: { x: 250, y: 92, w: 460, h: 366 },
  lpDiff(i)    { return { x: 350 + i * 78, y: 148, w: 72, h: 30 }; },
  lpDolphin(i) { return { x: 350 + i * 82, y: 190, w: 76, h: 52 }; },
  lpBomb(i)    { return { x: 350 + i * 38, y: 264, w: 34, h: 28 }; },
  lpGo()       { return { x: 355, y: 384, w: 250, h: 44 }; },
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

  // ---- 출격 준비 창 ----
  // 해역 무관 이전 선택(난이도·돌고래·봄)을 기억. 특별히 바꿀 게 없으면
  // 마커가 출격 버튼에 붙어 있으므로 Enter 두 번으로 바로 출격.
  DOLPHIN_TYPES: [null, 'homing', 'burst', 'pierce'],

  openLaunch() {
    this.launchOpen = true;
    this.diffSel = Math.min(Meta.data.diffSel ?? 0, this.maxDiffFor(this.sel));
    this.cursor = { row: 3, col: 0 };
    Sound.sfx('uiSelect');
  },

  lpRowLen(row) { return [DIFFS.length, 4, BOMB_ORDER.length, 1][row]; },

  // 행 진입 시 마커를 현재 선택값 위에 놓는다
  lpSnapCol(row) {
    if (row === 0) return this.diffSel;
    if (row === 1) return Math.max(0, this.DOLPHIN_TYPES.indexOf(Meta.data.selected));
    if (row === 2) return Math.max(0, BOMB_ORDER.indexOf(Meta.data.bombSel || 'sonar'));
    return 0;
  },

  // 마커 위치의 항목을 선택 (잠겨 있으면 안내)
  lpActivate(game) {
    const { row, col } = this.cursor;
    if (row === 3) {
      Sound.sfx('uiSelect');
      this.launchOpen = false;
      game.launchStage(this.sel, this.diffSel);
      return true;
    }
    if (row === 0) {
      if (col <= this.maxDiffFor(this.sel)) {
        this.diffSel = col;
        Meta.data.diffSel = col; Meta.save();
        Sound.sfx('uiSelect');
      } else {
        Sound.sfx('deny');
        this.showToast(`${DIFFS[col - 1].name}로 이 해역을 클리어하면 해금`, false);
      }
    } else if (row === 1) {
      const t = this.DOLPHIN_TYPES[col];
      if (t === null || Meta.data.dolphinLv[t] > 0) {
        Meta.data.selected = t; Meta.save();
        Sound.sfx('uiSelect');
      } else {
        Sound.sfx('deny');
        this.showToast('세이브 섬 상점에서 해금하세요', false);
      }
    } else if (row === 2) {
      const id = BOMB_ORDER[col];
      if (bombUnlocked(id)) {
        Meta.data.bombSel = id; Meta.save();
        Sound.sfx('uiSelect');
      } else {
        Sound.sfx('deny');
        this.showToast('해당 보스를 잡으면 해금됩니다', false);
      }
    }
    return false;
  },

  updateLaunch(game, keys, clicks) {
    for (const k of keys) {
      if (k === 'escape' || k === 'x') { this.launchOpen = false; return; }
      else if (k === 'arrowup' || k === 'w') {
        this.cursor.row = (this.cursor.row + 3) % 4;
        this.cursor.col = this.lpSnapCol(this.cursor.row);
        Sound.sfx('uiMove');
      } else if (k === 'arrowdown' || k === 's') {
        this.cursor.row = (this.cursor.row + 1) % 4;
        this.cursor.col = this.lpSnapCol(this.cursor.row);
        Sound.sfx('uiMove');
      } else if (k === 'arrowleft' || k === 'a') {
        const n = this.lpRowLen(this.cursor.row);
        if (n > 1) { this.cursor.col = (this.cursor.col + n - 1) % n; Sound.sfx('uiMove'); }
      } else if (k === 'arrowright' || k === 'd') {
        const n = this.lpRowLen(this.cursor.row);
        if (n > 1) { this.cursor.col = (this.cursor.col + 1) % n; Sound.sfx('uiMove'); }
      } else if (k === 'enter' || k === 'z' || k === ' ') {
        if (this.lpActivate(game)) return;
      }
    }
    for (const p of clicks) {
      const P = this.LP;
      if (!this.inRect(p, P)) { this.launchOpen = false; continue; }   // 바깥 클릭 = 닫기
      if (this.inRect(p, this.lpGo())) {
        this.cursor = { row: 3, col: 0 };
        if (this.lpActivate(game)) return;
        continue;
      }
      for (let i = 0; i < DIFFS.length; i++) {
        if (this.inRect(p, this.lpDiff(i))) { this.cursor = { row: 0, col: i }; this.lpActivate(game); }
      }
      for (let i = 0; i < 4; i++) {
        if (this.inRect(p, this.lpDolphin(i))) { this.cursor = { row: 1, col: i }; this.lpActivate(game); }
      }
      for (let i = 0; i < BOMB_ORDER.length; i++) {
        if (this.inRect(p, this.lpBomb(i))) { this.cursor = { row: 2, col: i }; this.lpActivate(game); }
      }
    }
  },

  update(dt, game) {
    if (this.toastT > 0) this.toastT -= dt;
    this.sel = Math.min(this.sel, this.unlockedCount() - 1);
    const clicks = Input.consumeClicks();
    Input.consumeAny(); Input.consumeBomb();

    // ---- 출격 준비 창이 열려 있으면 전부 그쪽으로 ----
    if (this.launchOpen) {
      this.updateLaunch(game, Input.consumeKeyPresses(), clicks);
      return;
    }

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
        else if (k === 'enter' || k === 'z') { this.openLaunch(); return; }
        else if (k === 's' || k === 'x') { this.shopOpen = true; this.shopCursor = 0; }
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
      // 볼륨 컨트롤
      if (this.inRect(p, this.volBtn(0))) { Sound.cycleVol('bgm'); continue; }
      if (this.inRect(p, this.volBtn(1))) { Sound.cycleVol('sfx'); continue; }
      if (this.inRect(p, this.BTN.shop)) { this.shopOpen = true; continue; }
      // 해금된 노드 클릭 = 선택 (같은 노드 다시 클릭 = 출격 준비 창)
      for (let i = 0; i < this.unlockedCount() && i < STAGES.length; i++) {
        const n = this.NODES[i];
        if ((p.x - n.x) ** 2 + (p.y - n.y) ** 2 < 30 * 30) {
          if (this.sel === i) { this.openLaunch(); return; }
          this.sel = i;
          Sound.sfx('uiMove');
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

    // 세이브 섬 (상점) — 항해도 하단에는 이것만 남긴다.
    // 난이도·돌고래·봄은 해역 선택 후 출격 준비 창에서 고른다.
    this.button(ctx, this.BTN.shop, '세이브 섬 (상점)', '#ffb0c8', false);

    // 키보드 조작 힌트
    ctx.fillStyle = 'rgba(255,255,255,0.45)';
    ctx.font = Fonts.f(11);
    ctx.textAlign = 'center';
    ctx.fillText('←→ 해역 · Enter 출격 준비 · S 상점', CFG.W / 2, 430);

    if (this.launchOpen) this.drawLaunch(ctx);
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

  // 출격 준비 창: 난이도 → 돌고래 → 봄 → 출격. 마커는 출격에 붙은 채 열린다.
  drawLaunch(ctx) {
    const now = performance.now() / 1000;
    const P = this.LP;
    const cur = this.cursor;
    ctx.save();
    // 배경 딤
    ctx.fillStyle = 'rgba(4, 12, 40, 0.72)';
    ctx.fillRect(0, 0, CFG.W, CFG.H);
    // 패널
    ctx.fillStyle = 'rgba(10, 26, 70, 0.96)';
    ctx.strokeStyle = 'rgba(255,255,255,0.35)'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.roundRect(P.x, P.y, P.w, P.h, 14); ctx.fill(); ctx.stroke();

    // 제목: 해역명 + 최고 점수
    const stage = STAGES[this.sel];
    ctx.textAlign = 'center';
    ctx.fillStyle = '#fff'; ctx.font = Fonts.f(18, true);
    ctx.fillText(`${this.sel + 1}. ${stage.name}`, P.x + P.w / 2, P.y + 32);
    const best = Meta.bestFor(stage.id);
    if (best > 0) {
      ctx.fillStyle = '#ffe9a8'; ctx.font = Fonts.f(11);
      ctx.fillText(`최고 ${best.toLocaleString()}`, P.x + P.w / 2, P.y + 50);
    }

    // 마커 하이라이트 공통
    const marker = (r) => {
      ctx.strokeStyle = `rgba(255,255,255,${0.75 + Math.sin(now * 6) * 0.25})`;
      ctx.lineWidth = 2.5;
      ctx.beginPath(); ctx.roundRect(r.x - 4, r.y - 4, r.w + 8, r.h + 8, 9); ctx.stroke();
    };
    const label = (text, y) => {
      ctx.textAlign = 'left';
      ctx.fillStyle = 'rgba(255,255,255,0.55)'; ctx.font = Fonts.f(12);
      ctx.fillText(text, P.x + 24, y);
    };

    // ---- 0행: 난이도 ----
    label('난이도', 168);
    const maxD = this.maxDiffFor(this.sel);
    for (let d = 0; d < DIFFS.length; d++) {
      const r = this.lpDiff(d);
      const open = d <= maxD, selD = d === this.diffSel;
      ctx.fillStyle = selD ? 'rgba(255,255,255,0.18)' : 'rgba(255,255,255,0.06)';
      ctx.strokeStyle = open ? (selD ? DIFFS[d].color : 'rgba(255,255,255,0.35)') : 'rgba(255,255,255,0.15)';
      ctx.lineWidth = selD ? 2 : 1;
      ctx.beginPath(); ctx.roundRect(r.x, r.y, r.w, r.h, 7); ctx.fill(); ctx.stroke();
      ctx.fillStyle = open ? (selD ? DIFFS[d].color : 'rgba(255,255,255,0.6)') : 'rgba(255,255,255,0.25)';
      ctx.font = Fonts.f(12, true); ctx.textAlign = 'center';
      ctx.fillText(open ? DIFFS[d].name : '🔒', r.x + r.w / 2, r.y + 20);
      if (cur.row === 0 && cur.col === d) marker(r);
    }

    // ---- 1행: 돌고래 ----
    label('돌고래', 218);
    for (let i = 0; i < 4; i++) {
      const r = this.lpDolphin(i);
      const t = this.DOLPHIN_TYPES[i];
      const selected = Meta.data.selected === t;
      const unlocked = t === null || Meta.data.dolphinLv[t] > 0;
      ctx.fillStyle = selected ? 'rgba(125,255,216,0.22)' : 'rgba(255,255,255,0.07)';
      ctx.strokeStyle = selected ? '#7dffd8' : 'rgba(255,255,255,0.3)';
      ctx.lineWidth = selected ? 2 : 1;
      ctx.beginPath(); ctx.roundRect(r.x, r.y, r.w, r.h, 8); ctx.fill(); ctx.stroke();
      ctx.textAlign = 'center';
      if (t === null) {
        ctx.fillStyle = 'rgba(255,255,255,0.6)'; ctx.font = Fonts.f(12);
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
      if (cur.row === 1 && cur.col === i) marker(r);
    }

    // ---- 2행: 봄 ----
    label('봄', 284);
    const bombSel = Meta.data.bombSel || 'sonar';
    BOMB_ORDER.forEach((id, i) => {
      const r = this.lpBomb(i);
      const def = BOMB_DEFS[id];
      const open = bombUnlocked(id);
      const on = bombSel === id;
      ctx.fillStyle = on ? 'rgba(255,255,255,0.2)' : 'rgba(255,255,255,0.06)';
      ctx.strokeStyle = on ? def.color : (open ? 'rgba(255,255,255,0.3)' : 'rgba(255,255,255,0.12)');
      ctx.lineWidth = on ? 2 : 1;
      ctx.beginPath(); ctx.roundRect(r.x, r.y, r.w, r.h, 6); ctx.fill(); ctx.stroke();
      ctx.textAlign = 'center';
      if (open) {
        ctx.fillStyle = def.color;
        ctx.beginPath(); ctx.arc(r.x + r.w / 2, r.y + 14, on ? 7 : 5.5, 0, 6.28); ctx.fill();
      } else {
        ctx.fillStyle = 'rgba(255,255,255,0.25)'; ctx.font = Fonts.f(11);
        ctx.fillText('🔒', r.x + r.w / 2, r.y + 19);
      }
      if (cur.row === 2 && cur.col === i) marker(r);
    });
    // 봄 이름·설명: 마커가 봄 행이면 마커 위치의 봄, 아니면 선택된 봄
    const showBomb = BOMB_DEFS[cur.row === 2 ? BOMB_ORDER[cur.col] : bombSel];
    ctx.textAlign = 'left';
    ctx.fillStyle = showBomb.color; ctx.font = Fonts.f(12, true);
    ctx.fillText(showBomb.name + (bombUnlocked(cur.row === 2 ? BOMB_ORDER[cur.col] : bombSel) ? '' : ' (잠김)'), P.x + 100, 324);
    ctx.fillStyle = 'rgba(255,255,255,0.5)'; ctx.font = Fonts.f(11);
    ctx.fillText(showBomb.desc, P.x + 100, 340);

    // ---- 3행: 출격 ----
    const go = this.lpGo();
    this.button(ctx, go, `출격!  ▶  [${DIFFS[this.diffSel].name}]`, DIFFS[this.diffSel].color, true);
    if (cur.row === 3) marker(go);

    // 조작 힌트
    ctx.textAlign = 'center';
    ctx.fillStyle = 'rgba(255,255,255,0.4)'; ctx.font = Fonts.f(11);
    ctx.fillText('↑↓←→ 이동 · Enter 선택/출격 · Esc 닫기', P.x + P.w / 2, P.y + P.h - 14);
    ctx.restore();
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
