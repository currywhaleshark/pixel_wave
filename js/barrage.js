// ============================================================
// barrage.js — 데이터 기반 보스 탄막 실행기
// 에디터와 실제 게임이 이 파일을 함께 사용한다.
// 각도는 도(0=오른쪽, 90=아래), 좌표는 960×540 게임 좌표계.
// ============================================================
(function initBarrageRuntime(root) {
  'use strict';

  const TAU = Math.PI * 2;
  const EPS = 1e-7;
  const STORAGE_KEY = 'pixelWave.barragePatterns.v1';
  const TYPES = new Set(['fan', 'ring', 'spiral', 'rain', 'wall']);
  const KINDS = new Set(['bubble', 'spike', 'drop', 'mine', 'star', 'ghostflame']);

  const finite = (value, fallback = 0) => Number.isFinite(Number(value)) ? Number(value) : fallback;
  const clamp = (value, lo, hi) => Math.max(lo, Math.min(hi, finite(value, lo)));
  const rad = (degrees) => finite(degrees) * Math.PI / 180;

  function slug(value) {
    return String(value || '').trim().toLowerCase().replace(/[^a-z0-9-]+/g, '-').replace(/^-+|-+$/g, '');
  }

  function normalizeEmitter(raw = {}, index = 0) {
    const type = TYPES.has(raw.type) ? raw.type : 'fan';
    const start = clamp(raw.start, 0, 120);
    const end = clamp(raw.end ?? 12, start, 120);
    return {
      id: slug(raw.id) || `emitter-${index + 1}`,
      name: String(raw.name || `발사기 ${index + 1}`).slice(0, 80),
      enabled: raw.enabled !== false,
      type,
      start,
      end,
      interval: clamp(raw.interval ?? 1, 0.03, 60),
      burstCount: Math.round(clamp(raw.burstCount ?? 1, 1, 20)),
      burstGap: clamp(raw.burstGap ?? 0.1, 0.02, 10),
      source: raw.source === 'absolute' ? 'absolute' : 'boss',
      x: clamp(raw.x ?? 0, -480, 1440),
      y: clamp(raw.y ?? 0, -270, 810),
      bulletKind: KINDS.has(raw.bulletKind) ? raw.bulletKind : 'bubble',
      radius: clamp(raw.radius ?? 5, 1, 30),
      speed: clamp(raw.speed ?? 120, 0, 800),
      mineTimer: clamp(raw.mineTimer ?? 2.2, 0.2, 20),
      difficultyCount: clamp(raw.difficultyCount ?? 0, -20, 20),
      difficultySpeed: clamp(raw.difficultySpeed ?? 0, -0.4, 2),
      count: Math.round(clamp(raw.count ?? 3, 1, 160)),
      angle: finite(raw.angle, 180),
      angleStep: finite(raw.angleStep, 0),
      spread: clamp(raw.spread ?? 30, 0, 360),
      aim: !!raw.aim,
      arms: Math.round(clamp(raw.arms ?? 4, 1, 32)),
      rotationSpeed: finite(raw.rotationSpeed, 60),
      xMin: clamp(raw.xMin ?? 40, -480, 1440),
      xMax: clamp(raw.xMax ?? 920, -480, 1440),
      yMin: clamp(raw.yMin ?? -10, -270, 810),
      yMax: clamp(raw.yMax ?? 550, -270, 810),
      axis: raw.axis === 'horizontal' ? 'horizontal' : 'vertical',
      gapCount: Math.round(clamp(raw.gapCount ?? 2, 0, 159)),
      gapIndex: Math.round(clamp(raw.gapIndex ?? 2, 0, 159)),
      gapStep: Math.round(clamp(raw.gapStep ?? 1, -159, 159)),
      jitter: clamp(raw.jitter ?? 0, 0, 180),
    };
  }

  function normalize(raw = {}) {
    const duration = clamp(raw.duration ?? 12, 0.25, 120);
    const emitters = Array.isArray(raw.emitters) ? raw.emitters.slice(0, 32) : [];
    return {
      version: 1,
      id: slug(raw.id) || 'untitled-pattern',
      name: String(raw.name || '새 탄막').slice(0, 100),
      description: String(raw.description || '').slice(0, 500),
      duration,
      loop: raw.loop !== false,
      seed: Math.round(clamp(raw.seed ?? 1, 0, 2147483647)),
      emitters: emitters.map((emitter, index) => {
        const item = normalizeEmitter(emitter, index);
        item.end = Math.min(item.end, duration);
        item.start = Math.min(item.start, item.end);
        return item;
      }),
    };
  }

  function validate(raw) {
    const errors = [];
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return ['패턴 데이터가 객체가 아닙니다.'];
    if (raw.version !== undefined && raw.version !== 1) errors.push('지원하지 않는 version입니다.');
    if (!slug(raw.id)) errors.push('id는 영문 소문자, 숫자, 하이픈을 포함해야 합니다.');
    if (!Array.isArray(raw.emitters)) errors.push('emitters 배열이 필요합니다.');
    if (Array.isArray(raw.emitters) && raw.emitters.length > 32) errors.push('발사기는 최대 32개입니다.');
    if (finite(raw.duration, 0) <= 0 || finite(raw.duration, 0) > 120) errors.push('duration은 0초 초과 120초 이하여야 합니다.');
    const seen = new Set();
    for (const [index, item] of (Array.isArray(raw.emitters) ? raw.emitters : []).entries()) {
      if (!item || typeof item !== 'object') { errors.push(`emitters[${index}]가 객체가 아닙니다.`); continue; }
      if (!TYPES.has(item.type)) errors.push(`emitters[${index}].type이 올바르지 않습니다.`);
      const id = slug(item.id);
      if (!id) errors.push(`emitters[${index}].id가 필요합니다.`);
      if (seen.has(id)) errors.push(`발사기 id '${id}'가 중복됩니다.`);
      seen.add(id);
      if (finite(item.interval, 0) < 0.03) errors.push(`emitters[${index}].interval은 0.03초 이상이어야 합니다.`);
      if (finite(item.start, -1) < 0 || finite(item.end, -1) < finite(item.start, 0)) errors.push(`emitters[${index}]의 시작/끝 시간이 올바르지 않습니다.`);
    }
    return errors;
  }

  function hash(text) {
    let value = 2166136261;
    for (let i = 0; i < text.length; i++) {
      value ^= text.charCodeAt(i);
      value = Math.imul(value, 16777619);
    }
    return value >>> 0;
  }

  function randomFor(seed) {
    let state = (seed >>> 0) || 0x6d2b79f5;
    return function random() {
      state += 0x6d2b79f5;
      let t = state;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function compile(raw) {
    const pattern = normalize(raw);
    const events = [];
    for (const emitter of pattern.emitters) {
      if (!emitter.enabled) continue;
      let volley = 0;
      for (let base = emitter.start; base <= emitter.end + EPS; base += emitter.interval) {
        for (let burst = 0; burst < emitter.burstCount; burst++) {
          const time = base + burst * emitter.burstGap;
          if (time > emitter.end + EPS || time > pattern.duration + EPS) break;
          events.push({ time, emitter, volley, burst });
          volley++;
          if (events.length >= 10000) break;
        }
        if (events.length >= 10000) break;
      }
      if (events.length >= 10000) break;
    }
    events.sort((a, b) => a.time - b.time || a.emitter.id.localeCompare(b.emitter.id));
    return { pattern, events };
  }

  function sourcePoint(emitter, context) {
    const base = emitter.source === 'absolute' ? { x: 0, y: 0 } : (context.source || { x: 0, y: 0 });
    return { x: base.x + emitter.x, y: base.y + emitter.y };
  }

  function countFor(emitter, difficulty) {
    return Math.max(1, Math.round(emitter.count + difficulty * emitter.difficultyCount));
  }

  function speedFor(emitter, difficulty) {
    return Math.max(0, emitter.speed * (1 + difficulty * emitter.difficultySpeed));
  }

  function fireEvent(event, pattern, context, emit) {
    const e = event.emitter;
    const difficulty = clamp(context.difficulty ?? 0, 0, 2);
    const count = countFor(e, difficulty);
    const speed = speedFor(e, difficulty);
    const point = sourcePoint(e, context);
    const target = context.target || { x: point.x - 100, y: point.y };
    const aimed = Math.atan2(target.y - point.y, target.x - point.x);
    const baseAngle = e.aim ? aimed : rad(e.angle + event.volley * e.angleStep);
    const rng = randomFor(pattern.seed + hash(e.id) + Math.imul(event.volley + 1, 2654435761));

    const bullet = (x, y, angle, kind = e.bulletKind) => {
      const a = angle + rad((rng() - 0.5) * e.jitter);
      const item = { x, y, vx: Math.cos(a) * speed, vy: Math.sin(a) * speed, r: e.radius, kind, emitterId: e.id };
      if (kind === 'mine') item.timer = e.mineTimer;
      emit(item);
    };

    if (e.type === 'ring') {
      for (let i = 0; i < count; i++) bullet(point.x, point.y, baseAngle + i / count * TAU);
      return;
    }
    if (e.type === 'fan') {
      const spread = rad(e.spread);
      for (let i = 0; i < count; i++) {
        const offset = count === 1 ? 0 : (i / (count - 1) - 0.5) * spread;
        bullet(point.x, point.y, baseAngle + offset);
      }
      return;
    }
    if (e.type === 'spiral') {
      const angle = rad(e.angle + event.time * e.rotationSpeed + event.volley * e.angleStep);
      const arms = Math.max(1, e.arms + Math.round(difficulty * e.difficultyCount));
      for (let i = 0; i < arms; i++) bullet(point.x, point.y, angle + i / arms * TAU);
      return;
    }
    if (e.type === 'rain') {
      const angle = rad(e.angle + event.volley * e.angleStep);
      for (let i = 0; i < count; i++) {
        const x = e.xMin + rng() * (e.xMax - e.xMin);
        const y = e.yMin + rng() * Math.max(0, e.yMax - e.yMin);
        bullet(x, y, angle);
      }
      return;
    }
    if (e.type === 'wall') {
      const total = count;
      const gapCount = Math.min(total - 1, e.gapCount);
      const gapStart = ((e.gapIndex + event.volley * e.gapStep) % total + total) % total;
      const inGap = (index) => {
        for (let g = 0; g < gapCount; g++) if ((gapStart + g) % total === index) return true;
        return false;
      };
      for (let i = 0; i < total; i++) {
        if (inGap(i)) continue;
        const ratio = total === 1 ? 0.5 : i / (total - 1);
        const x = e.axis === 'vertical' ? e.xMin + (e.xMax - e.xMin) * ratio : e.xMin;
        const y = e.axis === 'horizontal' ? e.yMin + (e.yMax - e.yMin) * ratio : e.yMin;
        bullet(x, y, rad(e.angle + event.volley * e.angleStep));
      }
    }
  }

  class Runner {
    constructor(rawPattern, options = {}) {
      const compiled = compile(rawPattern);
      this.pattern = compiled.pattern;
      this.events = compiled.events;
      this.emit = typeof options.emit === 'function' ? options.emit : () => {};
      this.reset();
    }

    reset() {
      this.time = 0;
      this.cursor = 0;
      this.loops = 0;
      this.finished = false;
      this.started = false;
    }

    _advance(toTime, context) {
      while (this.cursor < this.events.length && this.events[this.cursor].time <= toTime + EPS) {
        fireEvent(this.events[this.cursor], this.pattern, context, this.emit);
        this.cursor++;
      }
      this.time = toTime;
    }

    update(dt, context = {}) {
      if (this.finished || dt < 0) return;
      let remaining = Math.min(finite(dt), 10);
      if (!this.started) {
        this.started = true;
        this._advance(this.time, context);
      }
      while (remaining > EPS && !this.finished) {
        if (this.time >= this.pattern.duration - EPS) {
          if (!this.pattern.loop) { this.finished = true; break; }
          this.time = 0; this.cursor = 0; this.loops++;
          this._advance(0, context);
        }
        const step = Math.min(remaining, this.pattern.duration - this.time);
        this._advance(this.time + step, context);
        remaining -= step;
        if (step <= EPS) break;
      }
    }

    seek(time, context = {}) {
      this.reset();
      this.started = true;
      this._advance(clamp(time, 0, this.pattern.duration), context);
    }

    timeToNext() {
      if (this.cursor < this.events.length) return Math.max(0, this.events[this.cursor].time - this.time);
      if (this.pattern.loop && this.events.length) return Math.max(0, this.pattern.duration - this.time + this.events[0].time);
      return Infinity;
    }
  }

  function get(id) {
    // 정적 호스팅·모바일 모드: 에디터가 이 브라우저에 저장한 패턴을 우선한다.
    try {
      const local = JSON.parse(root.localStorage?.getItem(STORAGE_KEY) || '{}');
      if (local && local[id]) return normalize(local[id]);
    } catch (_) { /* 저장소를 쓸 수 없는 환경에서는 번들 데이터로 계속한다. */ }
    const registry = root.BARRAGE_PATTERN_DATA || {};
    return registry[id] ? normalize(registry[id]) : null;
  }

  root.BarrageRuntime = Object.freeze({ TYPES: [...TYPES], STORAGE_KEY, normalize, normalizeEmitter, validate, compile, Runner, get });
})(typeof globalThis !== 'undefined' ? globalThis : window);
