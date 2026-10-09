// 돌고래 공통 전술 안내. 실제 위험 상태만 읽으며 이동·공격·판정은 바꾸지 않는다.
(function initDolphinHints(root) {
  'use strict';

  const COLORS = { mine: '#ffe39a', blackout: '#aef7ee', current: '#b8e6ff' };

  function onScreen(target, viewport) {
    return !target.dead && !target.escaped && Number.isFinite(target.x) && Number.isFinite(target.y)
      && target.x >= 0 && target.x <= viewport.W && target.y >= 0 && target.y <= viewport.H;
  }

  function mineCue(mines) {
    const remaining = Math.min(...mines.map(b => b.timer));
    const targets = mines.filter(b => Math.abs(b.timer - remaining) < 0.001);
    // 줄은 배치한 패턴이 명시한다. 우연히 높이가 비슷한 등불을 한 줄로 추측하지 않는다.
    const byRow = new Map();
    for (const target of targets) {
      if (!Number.isInteger(target.mineHintRow)) continue;
      if (!byRow.has(target.mineHintRow)) byRow.set(target.mineHintRow, []);
      byRow.get(target.mineHintRow).push(target);
    }
    const rows = [...byRow.values()].filter(row => row.length > 1);
    const allRows = rows.length > 0 && rows.reduce((count, row) => count + row.length, 0) === targets.length;
    const mode = allRows ? (rows.length === 1 ? 'row' : 'rows') : (targets.length > 1 ? 'together' : 'order');
    const text = {
      order: '저 등불부터 터져!', together: '표시된 등불이 함께 터져!',
      row: '저 줄이 한꺼번에 터져!', rows: rows.length === 2 ? '저 두 줄이 함께 터져!' : '표시된 줄이 함께 터져!',
    }[mode];
    const label = allRows ? `${rows.length}줄 동시 폭발` : (targets.length > 1 ? '등불 동시 폭발' : '등불 폭발');
    return {
      key: `mine-${mode}`, topic: `mine-${mode}`, kind: 'mine', remaining,
      priority: remaining < 0.8 ? 90 : 50,
      text, short: `${label} · ${remaining.toFixed(1)}초`, targets, rows,
    };
  }

  class DolphinHints {
    constructor() {
      this.cue = null;
      this.speech = null;
      this.time = 0;
      this.nextSpeechAt = 0;
      this.taught = new Set();
    }

    update(dt, game, viewport) {
      if (game.paused) return;
      this.time += Math.max(0, dt);
      if (!game.dolphin || game.state !== 'play' || game.player.bubble > 0) {
        this.cue = null;
        this.speech = null;
        return;
      }

      const candidates = [];
      // 설치 순서가 아니라 남은 신관 시간으로 선택한다. 동시 폭발은 모두 표시한다.
      const mines = game.ebullets.filter(b => b.kind === 'mine' && Number.isFinite(b.timer)
        && b.timer > 0 && b.timer <= 2.2 && onScreen(b, viewport));
      if (mines.length) candidates.push(mineCue(mines));

      const boss = game.boss;
      const advice = boss && !boss.dead ? boss.dolphinHint?.() : null;
      if (advice?.kind === 'blackout' && advice.remaining > 0) {
        candidates.push({
          key: 'blackout', topic: 'blackout', kind: 'blackout', priority: 60,
          text: '독니를 잡으면 빨리 끝나!',
          short: `독니 격파로 단축 · ${advice.remaining.toFixed(1)}초`,
          targets: advice.targets.filter(e => onScreen(e, viewport)
            && e.lifecycle?.hittable === true && e.isHittable()),
        });
      } else if (advice?.kind === 'current' && advice.remaining > 0) {
        const right = advice.direction > 0;
        candidates.push({
          key: `current-${right ? 'right' : 'left'}-${advice.upcoming ? 'next' : 'now'}`,
          topic: 'current', kind: 'current', priority: 80,
          text: advice.upcoming ? `곧 ${right ? '오른쪽' : '왼쪽'}으로 밀려!` : null,
          short: `${advice.upcoming ? '곧' : '지금'} 해류 ${right ? '→' : '←'}`,
          direction: advice.direction, targets: [],
        });
      }

      candidates.sort((a, b) => b.priority - a.priority);
      this.cue = candidates[0] || null;
      if (!this.cue || this.speech?.key !== this.cue.key || this.speech?.until <= this.time) {
        this.speech = null;
      }
      // 긴 설명은 출격당 기믹별 한 번. 억제된 설명은 읽을 기회가 생겼을 때만 전달한다.
      if (this.cue?.text && !this.speech && !this.taught.has(this.cue.topic) && this.time >= this.nextSpeechAt) {
        this.speech = { key: this.cue.key, text: this.cue.text, until: this.time + 2.6 };
        this.taught.add(this.cue.topic);
        this.nextSpeechAt = this.time + 6;
      }
    }

    drawMarkers(ctx) {
      if (!this.cue) return;
      ctx.save();
      ctx.strokeStyle = COLORS[this.cue.kind];
      ctx.lineWidth = 2;
      const grouped = new Set();
      // 같은 순간에 터질 줄만 빈 점선 테두리로 묶는다. 두 줄 사이의 빈 공간은 묶지 않는다.
      ctx.save();
      ctx.setLineDash([8, 6]);
      for (const row of this.cue.rows || []) {
        const radius = target => Math.max(14, (target.r || 7) + 7);
        const left = Math.floor(Math.min(...row.map(target => target.x - radius(target))) / 2) * 2;
        const top = Math.floor(Math.min(...row.map(target => target.y - radius(target))) / 2) * 2;
        const right = Math.ceil(Math.max(...row.map(target => target.x + radius(target))) / 2) * 2;
        const bottom = Math.ceil(Math.max(...row.map(target => target.y + radius(target))) / 2) * 2;
        ctx.strokeRect(left, top, right - left, bottom - top);
        for (const target of row) grouped.add(target);
      }
      ctx.restore();
      // 속을 채우지 않는 모서리 표식: 탄·눈·피격판정을 덮지 않는다.
      for (const target of this.cue.targets) {
        if (grouped.has(target)) continue;
        const x = Math.round(target.x / 2) * 2, y = Math.round(target.y / 2) * 2;
        const r = this.cue.kind === 'mine' ? Math.max(14, (target.r || 7) + 7) : 20;
        const arm = 6;
        ctx.beginPath();
        for (const dx of [-1, 1]) for (const dy of [-1, 1]) {
          ctx.moveTo(x + dx * (r - arm), y + dy * r);
          ctx.lineTo(x + dx * r, y + dy * r);
          ctx.lineTo(x + dx * r, y + dy * (r - arm));
        }
        ctx.stroke();
      }
      ctx.restore();
    }

    drawCaption(ctx, viewport, dolphin) {
      if (!this.cue) return;
      const text = this.speech?.text || this.cue.short;
      ctx.save();
      const font = Fonts.f(this.speech ? 22 : 18, true);
      ctx.font = font;
      const width = Math.ceil(ctx.measureText(text).width) + 76;
      const x = Math.round((viewport.W - width) / 2), y = 100;
      ctx.fillStyle = 'rgba(6,20,40,0.88)';
      ctx.fillRect(x, y, width, 32);
      ctx.fillStyle = COLORS[this.cue.kind];
      ctx.fillRect(x, y, 2, 32);
      ctx.textAlign = 'left';
      ctx.font = Fonts.f(11, true);
      ctx.fillStyle = dolphin.def.color;
      ctx.fillText('돌고래', x + 10, y + 21);
      ctx.font = font;
      ctx.fillStyle = COLORS[this.cue.kind];
      ctx.fillText(text, x + 62, y + 24);
      ctx.restore();
    }
  }

  root.DolphinHints = DolphinHints;
  if (typeof module !== 'undefined' && module.exports) module.exports = DolphinHints;
})(typeof globalThis !== 'undefined' ? globalThis : window);
