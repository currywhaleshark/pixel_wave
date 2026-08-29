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
  const TYPES = new Set(['fan', 'ring', 'spiral', 'rain', 'wall', 'laser']);
  const KINDS = new Set(['bubble', 'spike', 'drop', 'mine', 'star', 'ghostflame']);
  const ACTION_TYPES = new Set(['changeSpeed', 'changeDirection', 'spawn', 'vanish']);

  const finite = (value, fallback = 0) => Number.isFinite(Number(value)) ? Number(value) : fallback;
  const clamp = (value, lo, hi) => Math.max(lo, Math.min(hi, finite(value, lo)));
  const rad = (degrees) => finite(degrees) * Math.PI / 180;

  function slug(value) {
    return String(value || '').trim().toLowerCase().replace(/[^a-z0-9-]+/g, '-').replace(/^-+|-+$/g, '');
  }

  function normalizeMotion(raw = {}) {
    return {
      acceleration: clamp(raw.acceleration ?? 0, -800, 800),
      maxSpeed: clamp(raw.maxSpeed ?? 0, 0, 800),
      angularVelocity: clamp(raw.angularVelocity ?? 0, -720, 720),
      waveAmplitude: clamp(raw.waveAmplitude ?? 0, 0, 180),
      waveFrequency: clamp(raw.waveFrequency ?? 0, 0, 20),
      homingTurnRate: clamp(raw.homingTurnRate ?? 0, 0, 720),
      homingDuration: clamp(raw.homingDuration ?? 0, 0, 30),
    };
  }

  function normalizeAction(raw = {}, index = 0) {
    const type = ACTION_TYPES.has(raw.type) ? raw.type : 'spawn';
    return {
      id: slug(raw.id) || `action-${index + 1}`,
      type,
      at: clamp(raw.at ?? 1, 0, 120),
      repeat: Math.round(clamp(raw.repeat ?? 1, 1, 32)),
      interval: clamp(raw.interval ?? 0.3, 0.03, 30),
      value: finite(raw.value, type === 'changeSpeed' ? 100 : 0),
      duration: clamp(raw.duration ?? 0, 0, 30),
      relative: raw.relative !== false,
      aim: !!raw.aim,
      count: Math.round(clamp(raw.count ?? 6, 1, 64)),
      spread: clamp(raw.spread ?? 360, 0, 360),
      angle: finite(raw.angle, 0),
      speed: clamp(raw.speed ?? 100, 0, 800),
      bulletKind: KINDS.has(raw.bulletKind) ? raw.bulletKind : 'bubble',
      radius: clamp(raw.radius ?? 5, 1, 30),
      mineTimer: clamp(raw.mineTimer ?? 2.2, 0.2, 20),
    };
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
      motion: normalizeMotion(raw.motion),
      actions: (Array.isArray(raw.actions) ? raw.actions : []).slice(0, 8).map(normalizeAction),
      laserLength: clamp(raw.laserLength ?? 760, 20, 1600),
      laserWidth: clamp(raw.laserWidth ?? 18, 2, 120),
      laserTelegraph: clamp(raw.laserTelegraph ?? 0.8, 0.05, 10),
      laserActive: clamp(raw.laserActive ?? 1.1, 0.05, 20),
      laserFade: clamp(raw.laserFade ?? 0.35, 0.05, 10),
      laserRotationSpeed: clamp(raw.laserRotationSpeed ?? 0, -360, 360),
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
      if (Array.isArray(item.actions) && item.actions.length > 8) errors.push(`emitters[${index}].actions는 최대 8개입니다.`);
      for (const [actionIndex, action] of (Array.isArray(item.actions) ? item.actions : []).entries()) {
        if (!action || typeof action !== 'object' || !ACTION_TYPES.has(action.type)) errors.push(`emitters[${index}].actions[${actionIndex}].type이 올바르지 않습니다.`);
        if (finite(action?.at, -1) < 0) errors.push(`emitters[${index}].actions[${actionIndex}].at은 0 이상이어야 합니다.`);
      }
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

  function behaviorState(angle, speed, emitter, difficulty = 0, depth = 0) {
    return {
      age: 0,
      heading: angle,
      speed,
      difficulty,
      depth,
      motion: normalizeMotion(emitter.motion),
      actions: (emitter.actions || []).map(normalizeAction),
      fired: (emitter.actions || []).map(() => 0),
      speedTween: null,
      directionTween: null,
    };
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
      const item = {
        x, y,
        vx: Math.cos(a) * speed,
        vy: Math.sin(a) * speed,
        r: e.radius,
        kind,
        emitterId: e.id,
        barrage: behaviorState(a, speed, e, difficulty),
      };
      if (kind === 'mine') item.timer = e.mineTimer;
      emit(item);
    };

    if (e.type === 'laser') {
      const a = baseAngle + rad((rng() - 0.5) * e.jitter);
      emit({
        x: point.x,
        y: point.y,
        vx: Math.cos(a) * speed,
        vy: Math.sin(a) * speed,
        r: e.laserWidth / 2,
        kind: 'laser',
        emitterId: e.id,
        laser: {
          age: 0,
          angle: a,
          length: e.laserLength,
          width: e.laserWidth + difficulty * Math.max(0, e.difficultyCount),
          telegraph: e.laserTelegraph,
          active: e.laserActive,
          fade: e.laserFade,
          rotationSpeed: rad(e.laserRotationSpeed),
        },
        barrage: behaviorState(a, speed, e, difficulty),
      });
      return;
    }

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

  function shortestAngle(from, to) {
    let delta = (to - from + Math.PI) % TAU;
    if (delta < 0) delta += TAU;
    return delta - Math.PI;
  }

  function turnToward(from, to, maxDelta) {
    const delta = shortestAngle(from, to);
    return from + Math.max(-maxDelta, Math.min(maxDelta, delta));
  }

  function childProjectile(parent, action, angle, state) {
    const speed = action.speed;
    const child = {
      x: parent.x,
      y: parent.y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      r: action.radius,
      kind: action.bulletKind,
      emitterId: parent.emitterId,
      life: 0,
      barrage: behaviorState(angle, speed, { motion: {}, actions: [] }, state.difficulty, state.depth + 1),
    };
    if (child.kind === 'mine') child.timer = action.mineTimer;
    return child;
  }

  function spawnActionChildren(projectile, action, state, context) {
    if (typeof context.spawn !== 'function' || state.depth >= finite(context.maxDepth, 2)) return;
    const target = context.target || { x: projectile.x - 100, y: projectile.y };
    const aimed = Math.atan2(target.y - projectile.y, target.x - projectile.x);
    const base = action.aim ? aimed : action.relative ? state.heading + rad(action.angle) : rad(action.angle);
    const spread = rad(action.spread);
    const ring = action.spread >= 359.999;
    for (let i = 0; i < action.count; i++) {
      if (context.spawnBudget && context.spawnBudget.remaining <= 0) break;
      const offset = action.count === 1 ? 0 : ring ? i / action.count * TAU : (i / (action.count - 1) - 0.5) * spread;
      context.spawn(childProjectile(projectile, action, base + offset, state));
      if (context.spawnBudget) context.spawnBudget.remaining--;
    }
  }

  function executeAction(projectile, action, state, context) {
    if (action.type === 'changeSpeed') {
      const to = Math.max(0, action.relative ? state.speed + action.value : action.value);
      if (action.duration <= EPS) state.speed = to;
      else state.speedTween = { from: state.speed, to, start: state.age, duration: action.duration };
      return;
    }
    if (action.type === 'changeDirection') {
      const target = context.target || { x: projectile.x - 100, y: projectile.y };
      const aimed = Math.atan2(target.y - projectile.y, target.x - projectile.x);
      const to = action.aim ? aimed + rad(action.value) : action.relative ? state.heading + rad(action.value) : rad(action.value);
      if (action.duration <= EPS) state.heading = to;
      else state.directionTween = { from: state.heading, to: state.heading + shortestAngle(state.heading, to), start: state.age, duration: action.duration };
      return;
    }
    if (action.type === 'spawn') {
      spawnActionChildren(projectile, action, state, context);
      return;
    }
    if (action.type === 'vanish') projectile.dead = true;
  }

  function applyTweens(state) {
    if (state.speedTween) {
      const tween = state.speedTween;
      const p = clamp((state.age - tween.start) / Math.max(EPS, tween.duration), 0, 1);
      state.speed = tween.from + (tween.to - tween.from) * p;
      if (p >= 1) state.speedTween = null;
    }
    if (state.directionTween) {
      const tween = state.directionTween;
      const p = clamp((state.age - tween.start) / Math.max(EPS, tween.duration), 0, 1);
      state.heading = tween.from + (tween.to - tween.from) * p;
      if (p >= 1) state.directionTween = null;
    }
  }

  function laserState(projectile) {
    const laser = projectile?.laser;
    if (!laser) return { phase: 'none', active: false, alpha: 0 };
    const telegraphEnd = laser.telegraph;
    const activeEnd = telegraphEnd + laser.active;
    const fadeEnd = activeEnd + laser.fade;
    if (laser.age < telegraphEnd) return { phase: 'telegraph', active: false, alpha: clamp(laser.age / Math.max(EPS, telegraphEnd), 0.15, 1) };
    if (laser.age < activeEnd) return { phase: 'active', active: true, alpha: 1 };
    if (laser.age < fadeEnd) return { phase: 'fade', active: false, alpha: 1 - (laser.age - activeEnd) / Math.max(EPS, laser.fade) };
    return { phase: 'done', active: false, alpha: 0 };
  }

  function laserHits(projectile, point, radius = 0) {
    const state = laserState(projectile);
    if (!state.active) return false;
    const laser = projectile.laser;
    const x2 = projectile.x + Math.cos(laser.angle) * laser.length;
    const y2 = projectile.y + Math.sin(laser.angle) * laser.length;
    const dx = x2 - projectile.x;
    const dy = y2 - projectile.y;
    const length2 = dx * dx + dy * dy;
    const t = length2 <= EPS ? 0 : clamp(((point.x - projectile.x) * dx + (point.y - projectile.y) * dy) / length2, 0, 1);
    const nearX = projectile.x + dx * t;
    const nearY = projectile.y + dy * t;
    const hitRadius = laser.width / 2 + finite(radius);
    return (point.x - nearX) ** 2 + (point.y - nearY) ** 2 <= hitRadius ** 2;
  }

  function updateProjectile(projectile, dt, context = {}) {
    if (!projectile || projectile.dead || !projectile.barrage) return;
    const delta = clamp(dt, 0, 0.25);
    const state = projectile.barrage;
    state.age += delta;
    projectile.life = finite(projectile.life) + delta;

    for (let index = 0; index < state.actions.length && !projectile.dead; index++) {
      const action = state.actions[index];
      while (state.fired[index] < action.repeat && state.age + EPS >= action.at + state.fired[index] * action.interval) {
        executeAction(projectile, action, state, context);
        state.fired[index]++;
        if (action.type === 'vanish') break;
      }
    }
    if (projectile.dead) return;

    applyTweens(state);
    const motion = state.motion;
    state.speed = Math.max(0, state.speed + motion.acceleration * delta);
    if (motion.maxSpeed > 0) state.speed = Math.min(state.speed, motion.maxSpeed);
    state.heading += rad(motion.angularVelocity) * delta;
    if (motion.homingTurnRate > 0 && state.age <= motion.homingDuration && context.target) {
      const targetAngle = Math.atan2(context.target.y - projectile.y, context.target.x - projectile.x);
      state.heading = turnToward(state.heading, targetAngle, rad(motion.homingTurnRate) * delta);
    }
    const wave = motion.waveFrequency > 0 ? rad(motion.waveAmplitude) * Math.sin(state.age * motion.waveFrequency * TAU) : 0;
    const travelAngle = state.heading + wave;
    projectile.vx = Math.cos(travelAngle) * state.speed;
    projectile.vy = Math.sin(travelAngle) * state.speed;
    const speedMul = finite(context.speedMul, 1);
    const current = context.current || { x: 0, y: 0 };
    projectile.x += (projectile.vx * speedMul + finite(current.x)) * delta;
    projectile.y += (projectile.vy * speedMul + finite(current.y)) * delta;

    if (projectile.kind === 'laser' && projectile.laser) {
      projectile.laser.age = state.age;
      projectile.laser.angle = state.heading + projectile.laser.rotationSpeed * state.age + wave;
      if (laserState(projectile).phase === 'done') projectile.dead = true;
      return;
    }

    if (projectile.kind === 'mine' && Number.isFinite(projectile.timer)) {
      state.speed *= Math.max(0, 1 - 1.5 * delta);
      projectile.vx = Math.cos(travelAngle) * state.speed;
      projectile.vy = Math.sin(travelAngle) * state.speed;
      projectile.timer -= delta;
      if (projectile.timer <= 0) {
        projectile.dead = true;
        const count = Math.round(clamp(context.mineRingCount ?? 6 + state.difficulty, 1, 32));
        const mineAction = normalizeAction({
          type: 'spawn', count, spread: 360, speed: context.mineRingSpeed ?? 95,
          bulletKind: 'bubble', radius: 5, relative: true,
        });
        spawnActionChildren(projectile, mineAction, state, context);
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

  root.BarrageRuntime = Object.freeze({
    TYPES: [...TYPES], ACTION_TYPES: [...ACTION_TYPES], STORAGE_KEY,
    normalize, normalizeEmitter, normalizeMotion, normalizeAction,
    validate, compile, Runner, get, updateProjectile, laserState, laserHits,
  });
})(typeof globalThis !== 'undefined' ? globalThis : window);
