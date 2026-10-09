// 돌고래 공통 전술 안내. 실제 위험 상태만 읽으며 이동·공격·판정은 바꾸지 않는다.
(function initDolphinHints(root) {
  'use strict';

  const COLORS = {
    mine: '#ffe39a', blackout: '#aef7ee', current: '#b8e6ff', eye: '#ffe9a8',
    homing: '#c8d8ff', passage: '#bfe8d0', dash: '#ff9f8f', spiral: '#ffd76e',
    ambush: '#d8ffb0', surround: '#e4c8ff',
  };
  const HOMING_NEAR = 200;   // 이 거리 안에서 따라오는 탄만 안내한다 (멀리 있는 탄까지 세면 잔소리)
  const SURROUND_LEAD = 1.2; // 포위 진입 몇 초 전부터 알려줄지

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

  // 약추적 탄의 남은 유도 시간. 일반 탄(homing)과 탄막 공방 탄(motion) 둘 다 읽는다.
  function homingLeft(b) {
    if (b.homing && Number.isFinite(b.homing.duration)) return b.homing.duration - (b.homing.t || 0);
    const motion = b.barrage?.motion;
    if (motion?.homingTurnRate > 0) return motion.homingDuration - (b.barrage.age || 0);
    return 0;
  }

  function homingCue(game, viewport) {
    const p = game.player;
    let left = 0, ghost = false;
    for (const b of game.ebullets) {
      if (b.dead || !onScreen(b, viewport)) continue;
      const t = homingLeft(b);
      if (t > 0 && Math.hypot(b.x - p.x, b.y - p.y) < HOMING_NEAR) {
        left = Math.max(left, t);
        ghost ||= b.kind === 'ghostflame';
      }
    }
    if (left <= 0) return null;
    return {
      key: 'homing', topic: 'homing', kind: 'homing', priority: 30,
      text: `${ghost ? '유령불' : '저 탄'}은 잠깐만 따라와! 끌고 다녀!`, short: `유도 ${left.toFixed(1)}초`, targets: [],
    };
  }

  // 잠복 중인 바이퍼: 어둠 속이라 거의 안 보인다. 위치는 짚지 않고 "있다"와 시간만.
  function ambushCue(game, viewport) {
    const api = root.StageEnemyState;
    let count = 0, left = Infinity;
    for (const e of game.enemies) {
      if (e.kind !== 'viper' || e.lifecycle?.phase !== 'unlit' || !onScreen(e, viewport)) continue;
      const reveal = api ? api.normalize('viper', e.params).revealDelay : (e.params?.revealDelay ?? 0.8);
      count++;
      left = Math.min(left, Math.max(0, reveal - e.t));
    }
    if (!count) return null;
    return {
      key: 'ambush', topic: 'ambush', kind: 'ambush', priority: 45,
      text: '어둠 속에 뭔가 숨어 있어!', short: `잠복 ${count} · ${left.toFixed(1)}초`, targets: [],
    };
  }

  // 포위 링: 플레이어 둘레(일부는 화면 밖)에서 동시에 들어온다. 빈틈은 알려주지 않는다.
  function surroundCue(game) {
    const sp = game.spawner;
    if (!sp?.events || !Number.isInteger(sp.idx) || !Number.isFinite(game.stageT)) return null;
    let count = 0, left = Infinity;
    for (let i = sp.idx; i < sp.events.length; i++) {
      const ev = sp.events[i];
      const dt = ev.at - game.stageT;
      if (dt > SURROUND_LEAD) break;
      if (ev.type !== 'spawn-enemy' || !Number.isFinite(ev.enemy?.surroundAngle)) continue;
      count++;
      left = Math.min(left, Math.max(0, dt));
    }
    if (!count) return null;
    return {
      key: 'surround', topic: 'surround', kind: 'surround', priority: 70,
      text: '포위 온다! 둘레를 봐!', short: `포위 · ${left.toFixed(1)}초`, targets: [],
    };
  }

  // 보스가 내놓는 상태를 안내로 바꾼다. 보스는 상태만 알리고 문구는 여기서 정한다.
  function bossCue(advice, game, viewport) {
    if (!advice) return null;
    if (advice.kind === 'blackout' && advice.remaining > 0) {
      return {
        key: 'blackout', topic: 'blackout', kind: 'blackout', priority: 60,
        text: '독니를 잡으면 빨리 끝나!',
        short: `독니 격파로 단축 · ${advice.remaining.toFixed(1)}초`,
        targets: advice.targets.filter(e => onScreen(e, viewport)
          && e.lifecycle?.hittable === true && e.isHittable()),
      };
    }
    if (advice.kind === 'current' && advice.remaining > 0) {
      const right = advice.direction > 0;
      return {
        key: `current-${right ? 'right' : 'left'}-${advice.upcoming ? 'next' : 'now'}`,
        topic: 'current', kind: 'current', priority: 80,
        text: advice.upcoming ? `곧 ${right ? '오른쪽' : '왼쪽'}으로 밀려!` : null,
        short: `${advice.upcoming ? '곧' : '지금'} 해류 ${right ? '→' : '←'}`,
        direction: advice.direction, targets: [],
      };
    }
    if (advice.kind === 'eye') {
      // 폭풍탄은 눈 반경에서 멈춘다. 판정 반경만큼 안쪽이어야 "눈 속"이라 부른다.
      const dx = advice.center.x - game.player.x, dy = advice.center.y - game.player.y;
      const inside = Math.hypot(dx, dy) < advice.radius - 12;
      const arrow = Math.abs(dx) >= Math.abs(dy) ? (dx > 0 ? '→' : '←') : (dy > 0 ? '↓' : '↑');
      const topic = advice.moving ? 'eye-move' : 'eye';
      return {
        key: topic, topic, kind: 'eye', priority: 40,
        text: advice.moving ? '눈이 움직여! 같이 헤엄쳐!' : '다가가! 눈 속은 고요해',
        short: inside ? '태풍의 눈 · 고요' : `태풍의 눈 ${arrow}`,
        targets: [],
      };
    }
    if (advice.kind === 'passage' && advice.remaining > 0) {
      return {
        key: 'passage', topic: 'passage', kind: 'passage', priority: 35,
        text: '지금 몸통은 통과돼! 유령만 피해!',
        short: `몸통 통과 · ${advice.remaining.toFixed(1)}초`, targets: [],
      };
    }
    if (advice.kind === 'dashBack') {
      return {
        key: 'dashBack', topic: 'dashBack', kind: 'dash', priority: 85,
        text: '돌아온다! 왼쪽에서 다시 와!',
        short: advice.upcoming ? '되돌아옴 ←' : '왼쪽에서 돌진 →', targets: [],
      };
    }
    if (advice.kind === 'counterSpiral') {
      return {
        key: 'counterSpiral', topic: 'counterSpiral', kind: 'spiral', priority: 35,
        text: '가시는 반대로 돌아! 교차하는 틈을 봐!',
        short: '기포 시계 · 가시 반시계', targets: [],
      };
    }
    return null;
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
      const fromBoss = bossCue(boss && !boss.dead ? boss.dolphinHint?.() : null, game, viewport);
      for (const cue of [fromBoss, surroundCue(game), ambushCue(game, viewport), homingCue(game, viewport)]) {
        if (cue) candidates.push(cue);
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
