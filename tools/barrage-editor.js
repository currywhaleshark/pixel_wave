(function initBarrageEditor() {
  'use strict';

  const $ = (selector) => document.querySelector(selector);
  const canvas = $('#preview');
  const ctx = canvas.getContext('2d');
  const COLORS = ['#55d9e8', '#ff87bd', '#ffd66e', '#9d8cff', '#7dffb2', '#ff9b6e', '#78a9ff', '#e889ff'];
  const TYPE_NAMES = { fan: '부채꼴', ring: '원형 링', spiral: '회전 나선', rain: '탄 비', wall: '틈새 벽' };
  const KIND_NAMES = { bubble: '기포', spike: '가시', drop: '물방울', mine: '기뢰', star: '별', ghostflame: '유령불' };
  const DIFF_SPEED = [1, 1.1, 1.22];
  const LOCAL_PATTERNS_KEY = BarrageRuntime.STORAGE_KEY;
  const DRAFT_KEY = 'pixelWave.barrageDraft.v1';
  const LAST_PATTERN_KEY = 'pixelWave.barrageLastPattern.v1';

  const defaultPattern = () => BarrageRuntime.normalize({
    version: 1, id: 'new-pattern', name: '새 탄막', description: '', duration: 12, loop: true, seed: 1,
    emitters: [],
  });

  const presetEmitter = (type, index, duration) => BarrageRuntime.normalizeEmitter({
    id: `${type}-${index + 1}`,
    name: { fan: '조준 부채꼴', ring: '원형 링', spiral: '회전 나선', rain: '탄 비', wall: '틈새 벽' }[type],
    type, enabled: true, start: 0.5, end: duration, interval: type === 'spiral' ? 0.16 : type === 'rain' ? 0.55 : 1.8,
    burstCount: 1, burstGap: 0.12, source: 'boss', x: type === 'fan' ? -20 : 0, y: 0,
    bulletKind: type === 'fan' || type === 'wall' ? 'spike' : 'bubble', radius: 5,
    mineTimer: 2.2,
    speed: type === 'wall' ? 135 : type === 'spiral' ? 90 : 120,
    difficultyCount: type === 'spiral' ? 1 : type === 'rain' ? 1 : 2, difficultySpeed: 0,
    count: type === 'ring' ? 16 : type === 'wall' ? 12 : type === 'rain' ? 2 : 3,
    angle: type === 'rain' ? 90 : type === 'wall' ? 90 : 180,
    angleStep: type === 'ring' ? 11 : 0, spread: 32, aim: type === 'fan', arms: 4, rotationSpeed: 70,
    xMin: 40, xMax: 920, yMin: -10, yMax: type === 'rain' ? -10 : 550,
    axis: 'vertical', gapCount: 2, gapIndex: 2, gapStep: 1, jitter: type === 'rain' ? 8 : 0,
  }, index);

  let pattern = defaultPattern();
  let selectedId = null;
  let runner = null;
  let bullets = [];
  let playing = true;
  let previewSpeed = 1;
  let difficulty = 0;
  let dirty = false;
  let lastFrame = performance.now();
  let player = { x: 170, y: 270, invuln: 0 };
  let boss = { x: 780, y: 270 };
  let dragTarget = null;
  let hitCount = 0;

  function cleanId(value, fallback = 'untitled-pattern') {
    return String(value || '').toLowerCase().replace(/[^a-z0-9-]+/g, '-').replace(/^-+|-+$/g, '') || fallback;
  }

  function uniqueId(base, except = null) {
    const ids = new Set(pattern.emitters.filter(e => e.id !== except).map(e => e.id));
    let id = String(base || 'emitter').toLowerCase().replace(/[^a-z0-9-]+/g, '-').replace(/^-+|-+$/g, '') || 'emitter';
    const root = id;
    let n = 2;
    while (ids.has(id)) id = `${root}-${n++}`;
    return id;
  }

  function context() {
    return { source: boss, target: player, difficulty };
  }

  function selectedEmitter() {
    return pattern.emitters.find(item => item.id === selectedId) || null;
  }

  function setStatus(message, kind = '') {
    const status = $('#saveStatus');
    status.textContent = message;
    status.className = `save-status ${kind}`;
  }

  function readJsonStorage(key, fallback) {
    try {
      const value = localStorage.getItem(key);
      return value ? JSON.parse(value) : fallback;
    } catch (_) {
      return fallback;
    }
  }

  function localPatterns() {
    const items = readJsonStorage(LOCAL_PATTERNS_KEY, {});
    return items && typeof items === 'object' && !Array.isArray(items) ? items : {};
  }

  function saveDraftNow() {
    try {
      localStorage.setItem(DRAFT_KEY, JSON.stringify(BarrageRuntime.normalize(pattern)));
      return true;
    } catch (_) {
      return false;
    }
  }

  function saveToDevice() {
    const items = localPatterns();
    items[pattern.id] = BarrageRuntime.normalize(pattern);
    localStorage.setItem(LOCAL_PATTERNS_KEY, JSON.stringify(items));
    localStorage.setItem(LAST_PATTERN_KEY, pattern.id);
    localStorage.removeItem(DRAFT_KEY);
  }

  function markDirty() {
    dirty = true;
    const saved = saveDraftNow();
    setStatus(saved ? '초안 자동저장됨' : '자동저장 불가 · JSON을 내보내세요', saved ? 'dirty' : 'error');
  }

  function loadIntoUi(data, clean = true) {
    pattern = BarrageRuntime.normalize(data);
    selectedId = pattern.emitters[0]?.id || null;
    dirty = !clean;
    $('#patternName').value = pattern.name;
    $('#patternId').value = pattern.id;
    $('#patternDuration').value = pattern.duration;
    $('#patternSeed').value = pattern.seed;
    $('#patternLoop').checked = pattern.loop;
    $('#patternDescription').value = pattern.description;
    setStatus(clean ? '불러옴' : '새 패턴', clean ? 'ok' : 'dirty');
    renderAll();
    restartPreview();
    if (!clean) saveDraftNow();
  }

  function normalizeAndRestart() {
    const oldSelected = selectedId;
    pattern = BarrageRuntime.normalize(pattern);
    selectedId = pattern.emitters.some(e => e.id === oldSelected) ? oldSelected : pattern.emitters[0]?.id || null;
    renderAll();
    restartPreview();
    markDirty();
  }

  function restartPreview() {
    bullets = [];
    hitCount = 0;
    player.invuln = 0;
    runner = new BarrageRuntime.Runner(pattern, { emit: bullet => bullets.push({ ...bullet, life: 0 }) });
    runner.update(0, context());
    $('#timeScrub').max = pattern.duration;
    $('#timeScrub').value = 0;
    updateTimeUi();
  }

  function renderAll() {
    renderEmitterList();
    renderInspector();
    renderTimeline();
    renderValidation();
  }

  function renderEmitterList() {
    const list = $('#emitterList');
    list.innerHTML = '';
    pattern.emitters.forEach((emitter, index) => {
      const item = document.createElement('button');
      item.type = 'button';
      item.className = `emitter-item ${emitter.id === selectedId ? 'selected' : ''} ${emitter.enabled ? '' : 'disabled'}`;
      item.style.setProperty('--emitter-color', COLORS[index % COLORS.length]);
      item.innerHTML = `<span class="emitter-color"></span><span class="emitter-name">${escapeHtml(emitter.name)}</span><span class="emitter-kind">${TYPE_NAMES[emitter.type]}</span>`;
      item.addEventListener('click', () => { selectedId = emitter.id; renderEmitterList(); renderInspector(); renderTimeline(); });
      list.appendChild(item);
    });
    if (!pattern.emitters.length) list.innerHTML = '<div class="empty-state">아래에서 첫 발사기를 추가하세요.</div>';
    $('#emitterCount').textContent = pattern.emitters.length;
  }

  function field(label, key, type = 'number', options = {}) {
    const value = selectedEmitter()?.[key];
    if (type === 'checkbox') {
      return `<label class="check"><input data-emitter-key="${key}" type="checkbox" ${value ? 'checked' : ''}> ${label}</label>`;
    }
    if (type === 'select') {
      const choices = options.choices.map(([choice, name]) => `<option value="${choice}" ${String(value) === String(choice) ? 'selected' : ''}>${name}</option>`).join('');
      return `<label>${label}<select data-emitter-key="${key}">${choices}</select></label>`;
    }
    const attrs = [options.min !== undefined ? `min="${options.min}"` : '', options.max !== undefined ? `max="${options.max}"` : '', options.step !== undefined ? `step="${options.step}"` : '', options.maxlength ? `maxlength="${options.maxlength}"` : ''].join(' ');
    return `<label>${label}<input data-emitter-key="${key}" type="${type}" value="${escapeHtml(String(value ?? ''))}" ${attrs}></label>`;
  }

  function group(title, content, hint = '') {
    return `<section class="inspector-group"><h3>${title}</h3>${hint ? `<p class="hint">${hint}</p>` : ''}${content}</section>`;
  }

  function renderInspector() {
    const emitter = selectedEmitter();
    $('#emptyInspector').hidden = !!emitter;
    $('#inspector').hidden = !emitter;
    $('#inspectorActions').hidden = !emitter;
    $('#selectedType').textContent = emitter ? TYPE_NAMES[emitter.type] : '-';
    if (!emitter) return;
    const form = $('#inspector');
    const common = field('사용', 'enabled', 'checkbox') + field('이름', 'name', 'text', { maxlength: 80 }) + field('ID', 'id', 'text') + field('종류', 'type', 'select', { choices: Object.entries(TYPE_NAMES) });
    const timing = `<div class="field-row">${field('시작', 'start', 'number', { min: 0, max: 120, step: 0.05 })}${field('끝', 'end', 'number', { min: 0, max: 120, step: 0.05 })}</div>` + `<div class="field-row">${field('발사 간격', 'interval', 'number', { min: 0.03, max: 60, step: 0.01 })}${field('연사 수', 'burstCount', 'number', { min: 1, max: 20, step: 1 })}</div>` + field('연사 간격', 'burstGap', 'number', { min: 0.02, max: 10, step: 0.01 });
    const bullet = `<div class="field-row">${field('탄 모양', 'bulletKind', 'select', { choices: Object.entries(KIND_NAMES) })}${field('탄 반지름', 'radius', 'number', { min: 1, max: 30, step: 1 })}</div>` + `<div class="field-row">${field('탄속', 'speed', 'number', { min: 0, max: 800, step: 1 })}${field('각도 흔들림', 'jitter', 'number', { min: 0, max: 180, step: 1 })}</div>` + field('기뢰 폭발 시간(초)', 'mineTimer', 'number', { min: 0.2, max: 20, step: 0.1 }) + `<div class="field-row">${field('난이도당 탄수', 'difficultyCount', 'number', { min: -20, max: 20, step: 1 })}${field('난이도당 탄속', 'difficultySpeed', 'number', { min: -0.4, max: 2, step: 0.05 })}</div>`;
    let specific = '';
    let position = '';
    if (['fan', 'ring', 'spiral'].includes(emitter.type)) {
      position = field('발사 위치', 'source', 'select', { choices: [['boss', '보스 기준'], ['absolute', '화면 절대좌표']] }) + `<div class="field-row">${field('X/오프셋', 'x', 'number', { step: 1 })}${field('Y/오프셋', 'y', 'number', { step: 1 })}</div>`;
    }
    if (emitter.type === 'fan') {
      specific = `<div class="field-row">${field('탄수', 'count', 'number', { min: 1, max: 160, step: 1 })}${field('부채 폭(°)', 'spread', 'number', { min: 0, max: 360, step: 0.5 })}</div>` + field('플레이어 조준', 'aim', 'checkbox') + `<div class="field-row">${field('기준 각도(°)', 'angle', 'number', { step: 1 })}${field('발사마다 회전(°)', 'angleStep', 'number', { step: 1 })}</div>`;
    } else if (emitter.type === 'ring') {
      specific = `<div class="field-row">${field('링 탄수', 'count', 'number', { min: 1, max: 160, step: 1 })}${field('기준 각도(°)', 'angle', 'number', { step: 1 })}</div>` + field('발사마다 회전(°)', 'angleStep', 'number', { step: 1 });
    } else if (emitter.type === 'spiral') {
      specific = `<div class="field-row">${field('나선 팔', 'arms', 'number', { min: 1, max: 32, step: 1 })}${field('회전속도(°/초)', 'rotationSpeed', 'number', { step: 1 })}</div>` + `<div class="field-row">${field('기준 각도(°)', 'angle', 'number', { step: 1 })}${field('발사마다 추가회전', 'angleStep', 'number', { step: 1 })}</div>`;
    } else if (emitter.type === 'rain') {
      specific = `<div class="field-row">${field('한 번의 탄수', 'count', 'number', { min: 1, max: 160, step: 1 })}${field('낙하 각도(°)', 'angle', 'number', { step: 1 })}</div>` + `<div class="field-row">${field('X 최소', 'xMin', 'number', { step: 1 })}${field('X 최대', 'xMax', 'number', { step: 1 })}</div>` + `<div class="field-row">${field('Y 최소', 'yMin', 'number', { step: 1 })}${field('Y 최대', 'yMax', 'number', { step: 1 })}</div>` + field('발사마다 회전(°)', 'angleStep', 'number', { step: 1 });
    } else if (emitter.type === 'wall') {
      specific = field('배치 방향', 'axis', 'select', { choices: [['vertical', '가로로 나열'], ['horizontal', '세로로 나열']] }) + `<div class="field-row">${field('전체 칸', 'count', 'number', { min: 1, max: 160, step: 1 })}${field('빈 칸 수', 'gapCount', 'number', { min: 0, max: 159, step: 1 })}</div>` + `<div class="field-row">${field('첫 빈 칸', 'gapIndex', 'number', { min: 0, max: 159, step: 1 })}${field('발사마다 틈 이동', 'gapStep', 'number', { min: -159, max: 159, step: 1 })}</div>` + `<div class="field-row">${field('X 최소', 'xMin', 'number', { step: 1 })}${field('X 최대', 'xMax', 'number', { step: 1 })}</div>` + `<div class="field-row">${field('Y 최소', 'yMin', 'number', { step: 1 })}${field('Y 최대', 'yMax', 'number', { step: 1 })}</div>` + `<div class="field-row">${field('이동 각도(°)', 'angle', 'number', { step: 1 })}${field('발사마다 회전', 'angleStep', 'number', { step: 1 })}</div>`;
    }
    form.innerHTML = group('기본', common) + group('시간', timing, 'interval마다 한 묶음, burst는 묶음 안의 연사입니다.') + (position ? group('발사점', position) : '') + group(TYPE_NAMES[emitter.type], specific) + group('탄과 난이도', bullet, '난이도 값 1은 노멀, 2는 하드에서 두 번 적용됩니다.');
  }

  function renderValidation() {
    const errors = BarrageRuntime.validate(pattern);
    $('#validation').textContent = errors.length ? `⚠ ${errors.join('\n⚠ ')}` : '';
    $('#savePattern').disabled = errors.length > 0;
  }

  function renderTimeline() {
    const duration = pattern.duration;
    const ruler = $('#timelineRuler');
    const steps = Math.min(8, Math.max(2, Math.round(duration / 2)));
    ruler.innerHTML = '';
    for (let i = 0; i <= steps; i++) {
      const mark = document.createElement('span');
      mark.className = 'ruler-mark';
      mark.style.left = `${i / steps * 100}%`;
      mark.textContent = `${(duration * i / steps).toFixed(duration < 10 ? 1 : 0)}s`;
      ruler.appendChild(mark);
    }
    const tracks = $('#timelineTracks');
    tracks.innerHTML = '';
    const compiled = BarrageRuntime.compile(pattern);
    pattern.emitters.forEach((emitter, index) => {
      const row = document.createElement('div');
      row.className = 'timeline-track';
      const events = compiled.events.filter(event => event.emitter.id === emitter.id);
      const dots = events.slice(0, 300).map(event => `<i class="event-dot" style="left:${event.time / duration * 100}%"></i>`).join('');
      row.innerHTML = `<span class="track-name">${escapeHtml(emitter.name)}</span><span class="track-lane" style="--emitter-color:${COLORS[index % COLORS.length]}"><i class="track-active" style="left:${emitter.start / duration * 100}%;width:${Math.max(0, emitter.end - emitter.start) / duration * 100}%"></i>${dots}</span>`;
      row.querySelector('.track-name').addEventListener('click', () => { selectedId = emitter.id; renderAll(); });
      row.querySelector('.track-lane').addEventListener('click', event => {
        selectedId = emitter.id;
        const rect = event.currentTarget.getBoundingClientRect();
        seekPreview((event.clientX - rect.left) / rect.width * duration);
        renderAll();
      });
      tracks.appendChild(row);
    });
    const playhead = document.createElement('i');
    playhead.id = 'playhead'; playhead.className = 'playhead';
    playhead.style.left = '90px';
    tracks.appendChild(playhead);
    const theoretical = compiled.events.length;
    $('#previewStats').textContent = `발사 ${theoretical}회/주기 · 화면 탄 ${bullets.length} · 피격 ${hitCount}`;
  }

  function updateTimelinePlayhead() {
    const playhead = $('#playhead');
    if (!playhead || !runner) return;
    const width = $('#timelineTracks').clientWidth - 90;
    playhead.style.left = `${90 + width * runner.time / pattern.duration}px`;
  }

  function updateTimeUi() {
    const time = runner?.time || 0;
    $('#timeLabel').textContent = `${time.toFixed(2).padStart(5, '0')} / ${pattern.duration.toFixed(2)}`;
    $('#timeScrub').value = time;
    updateTimelinePlayhead();
  }

  function seekPreview(time) {
    bullets = [];
    runner = new BarrageRuntime.Runner(pattern, { emit: bullet => bullets.push({ ...bullet, life: 0 }) });
    const target = Math.max(0, Math.min(pattern.duration, Number(time) || 0));
    const step = 1 / 120;
    while (runner.time < target - 0.0001) {
      const dt = Math.min(step, target - runner.time);
      runner.update(dt, context());
      updateBullets(dt);
    }
    updateTimeUi();
  }

  function updateBullets(dt) {
    const speedMul = DIFF_SPEED[difficulty];
    const spawned = [];
    for (const bullet of bullets) {
      bullet.x += bullet.vx * speedMul * dt;
      bullet.y += bullet.vy * speedMul * dt;
      bullet.life += dt;
      if (bullet.kind === 'mine') {
        bullet.vy *= Math.max(0, 1 - 1.5 * dt);
        bullet.timer -= dt;
        if (bullet.timer <= 0) {
          bullet.dead = true;
          for (let i = 0; i < 6 + difficulty; i++) {
            const angle = i / (6 + difficulty) * Math.PI * 2;
            spawned.push({ x: bullet.x, y: bullet.y, vx: Math.cos(angle) * 95, vy: Math.sin(angle) * 95, r: 5, kind: 'bubble', life: 0 });
          }
        }
      }
      if (player.invuln <= 0 && (bullet.x - player.x) ** 2 + (bullet.y - player.y) ** 2 < (bullet.r + 6) ** 2) {
        player.invuln = 0.8;
        hitCount++;
        showHit();
      }
    }
    player.invuln = Math.max(0, player.invuln - dt);
    bullets = bullets.filter(b => !b.dead && b.x > -60 && b.x < 1020 && b.y > -60 && b.y < 600 && b.life < 20).concat(spawned);
  }

  function showHit() {
    const flash = $('#hitFlash');
    flash.classList.remove('show');
    void flash.offsetWidth;
    flash.classList.add('show');
  }

  function draw() {
    const gradient = ctx.createLinearGradient(0, 0, 0, 540);
    gradient.addColorStop(0, '#123f78'); gradient.addColorStop(0.55, '#0a2a5f'); gradient.addColorStop(1, '#061b3f');
    ctx.fillStyle = gradient; ctx.fillRect(0, 0, 960, 540);
    ctx.strokeStyle = 'rgba(130,200,230,0.08)'; ctx.lineWidth = 1;
    for (let x = 0; x <= 960; x += 60) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, 540); ctx.stroke(); }
    for (let y = 0; y <= 540; y += 60) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(960, y); ctx.stroke(); }
    for (let i = 0; i < 32; i++) {
      const x = (i * 137 + 29) % 960, y = (i * 83 + 41) % 540;
      ctx.fillStyle = `rgba(190,235,255,${0.12 + (i % 3) * 0.05})`; ctx.fillRect(x, y, 2, 2);
    }
    drawBoss();
    bullets.forEach(drawBullet);
    drawPlayer();
    ctx.fillStyle = 'rgba(3,13,30,0.65)'; ctx.fillRect(10, 10, 230, 31);
    ctx.fillStyle = '#bfe8ff'; ctx.font = '12px Galmuri11, monospace';
    ctx.fillText(`${pattern.name}  ·  ${['이지','노멀','하드'][difficulty]}`, 20, 30);
  }

  function drawBoss() {
    ctx.save(); ctx.translate(boss.x, boss.y);
    const pulse = 1 + Math.sin(performance.now() / 260) * 0.035;
    ctx.strokeStyle = '#ffe68a'; ctx.lineWidth = 4;
    for (let i = 0; i < 12; i++) {
      const a = i / 12 * Math.PI * 2;
      ctx.beginPath(); ctx.moveTo(Math.cos(a) * 34, Math.sin(a) * 34); ctx.lineTo(Math.cos(a) * 48, Math.sin(a) * 48); ctx.stroke();
    }
    ctx.scale(pulse, pulse); ctx.fillStyle = '#e9ca58'; ctx.beginPath(); ctx.arc(0, 0, 36, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(-10, -6, 5, 0, Math.PI * 2); ctx.arc(10, -6, 5, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#17304a'; ctx.beginPath(); ctx.arc(-9, -6, 2, 0, Math.PI * 2); ctx.arc(9, -6, 2, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }

  function drawPlayer() {
    ctx.save(); ctx.translate(player.x, player.y);
    if (player.invuln > 0 && Math.floor(player.invuln * 14) % 2 === 0) ctx.globalAlpha = 0.35;
    ctx.fillStyle = '#ff91c3'; ctx.beginPath(); ctx.arc(7, -4, 9, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#ffdfca'; ctx.beginPath(); ctx.arc(9, -3, 5, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#63e5d5'; ctx.beginPath(); ctx.moveTo(2, 0); ctx.quadraticCurveTo(-11, -5, -20, -12); ctx.lineTo(-16, 0); ctx.lineTo(-20, 12); ctx.quadraticCurveTo(-10, 5, 2, 0); ctx.fill();
    ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(0, 0, 3, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#ff6fa5'; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(0, 0, 6, 0, Math.PI * 2); ctx.stroke();
    ctx.restore();
  }

  function drawBullet(bullet) {
    ctx.save(); ctx.translate(bullet.x, bullet.y);
    const colors = { bubble: '#bdeaff', spike: '#ff9ec7', drop: '#8fc9ff', mine: '#ffd66e', star: '#bfffea', ghostflame: '#a8f0be' };
    const color = colors[bullet.kind] || '#fff';
    if (bullet.kind === 'bubble') {
      ctx.fillStyle = '#a8dfff55'; ctx.strokeStyle = color; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(0, 0, bullet.r + 1, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    } else if (bullet.kind === 'spike' || bullet.kind === 'drop') {
      ctx.rotate(Math.atan2(bullet.vy, bullet.vx)); ctx.fillStyle = color; ctx.beginPath(); ctx.moveTo(bullet.r + 3, 0); ctx.lineTo(-bullet.r, -bullet.r * 0.7); ctx.lineTo(-bullet.r, bullet.r * 0.7); ctx.closePath(); ctx.fill();
    } else {
      ctx.shadowColor = color; ctx.shadowBlur = 9; ctx.fillStyle = color; ctx.beginPath(); ctx.arc(0, 0, bullet.r, 0, Math.PI * 2); ctx.fill();
    }
    ctx.restore();
  }

  async function refreshLibrary(selectId = pattern.id) {
    const select = $('#patternLibrary');
    const catalog = new Map();
    for (const item of Object.values(globalThis.BARRAGE_PATTERN_DATA || {})) {
      catalog.set(item.id, { ...item, sourceLabel: '기본' });
    }
    try {
      const response = await fetch('/api/barrage-patterns');
      if (!response.ok) throw new Error('목록 응답 오류');
      const data = await response.json();
      for (const item of data.patterns) catalog.set(item.id, { ...item, sourceLabel: '프로젝트' });
    } catch (_) { /* 정적·오프라인 모드에서는 기기와 번들 목록만 사용한다. */ }
    for (const item of Object.values(localPatterns())) {
      catalog.set(item.id, { ...item, emitterCount: item.emitters?.length || 0, sourceLabel: '이 기기' });
    }
    const items = [...catalog.values()].sort((a, b) => String(a.name).localeCompare(String(b.name), 'ko'));
    select.innerHTML = '<option value="">저장된 패턴 선택…</option>' + items.map(item => `<option value="${item.id}" ${item.id === selectId ? 'selected' : ''}>${escapeHtml(item.name)} · ${item.sourceLabel}</option>`).join('');
  }

  async function loadPattern(id) {
    if (!id) return;
    if (dirty && !confirm('저장하지 않은 변경을 버리고 다른 패턴을 불러올까요?')) { $('#patternLibrary').value = pattern.id; return; }
    const local = localPatterns()[id];
    if (local) {
      try { localStorage.removeItem(DRAFT_KEY); } catch (_) { /* 읽기 전용 저장소 */ }
      loadIntoUi(local, true);
      return;
    }
    try {
      const response = await fetch(`/api/barrage-patterns/${encodeURIComponent(id)}`);
      if (!response.ok) throw new Error('패턴을 불러오지 못했습니다.');
      loadIntoUi(await response.json(), true);
    } catch (error) {
      const fallback = globalThis.BARRAGE_PATTERN_DATA?.[id];
      if (fallback) loadIntoUi(fallback, true);
      else setStatus(error.message, 'error');
    }
  }

  async function savePattern() {
    pattern = BarrageRuntime.normalize(pattern);
    const errors = BarrageRuntime.validate(pattern);
    if (errors.length) { setStatus('검증 오류', 'error'); renderValidation(); return false; }
    const saved = [];
    try {
      saveToDevice();
      saved.push('이 기기');
    } catch (_) { /* 서버 저장을 한 번 더 시도한다. */ }
    try {
      const response = await fetch(`/api/barrage-patterns/${encodeURIComponent(pattern.id)}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(pattern),
      });
      const result = await response.json();
      if (!response.ok) throw new Error([result.error, ...(result.details || [])].filter(Boolean).join(' '));
      saved.push('프로젝트 파일');
    } catch (_) { /* 정적 호스팅에서는 서버 API가 없는 것이 정상이다. */ }
    if (!saved.length) { setStatus('저장 불가 · JSON을 내보내세요', 'error'); return false; }
    dirty = false;
    try { localStorage.removeItem(DRAFT_KEY); } catch (_) { /* 서버 저장은 이미 성공했다. */ }
    setStatus(`${saved.join(' + ')}에 저장됨`, 'ok');
    await refreshLibrary(pattern.id);
    return true;
  }

  async function exportJson() {
    const text = JSON.stringify(BarrageRuntime.normalize(pattern), null, 2) + '\n';
    const fileName = `${pattern.id}.json`;
    const file = typeof File === 'function' ? new File([text], fileName, { type: 'application/json' }) : null;
    const mobile = matchMedia('(pointer: coarse)').matches;
    if (file && mobile && navigator.share && navigator.canShare?.({ files: [file] })) {
      try {
        await navigator.share({ title: pattern.name, text: '픽셀 파도 보스 탄막 JSON', files: [file] });
        setStatus('JSON 공유 완료', 'ok');
        return;
      } catch (error) {
        if (error.name === 'AbortError') { setStatus('JSON 공유 취소', ''); return; }
      }
    }
    const blob = new Blob([text], { type: 'application/json' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(link.href), 1000);
    setStatus(`${fileName} 내보냄`, 'ok');
  }

  function escapeHtml(value) {
    return String(value).replace(/[&<>'"]/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' })[character]);
  }

  function canvasPoint(event) {
    const rect = canvas.getBoundingClientRect();
    return { x: (event.clientX - rect.left) / rect.width * 960, y: (event.clientY - rect.top) / rect.height * 540 };
  }

  // 모바일에서 입력 중 앱을 닫아도 이름·메모의 마지막 글자까지 즉시 복구한다.
  document.addEventListener('input', event => {
    const patternKey = event.target.dataset.patternKey;
    if (patternKey === 'name' || patternKey === 'description') {
      pattern[patternKey] = event.target.value;
      markDirty();
      return;
    }
    const emitterKey = event.target.dataset.emitterKey;
    if (emitterKey === 'name') {
      const emitter = selectedEmitter();
      if (!emitter) return;
      emitter.name = event.target.value;
      renderEmitterList();
      renderTimeline();
      markDirty();
    }
  });

  document.addEventListener('change', event => {
    const patternKey = event.target.dataset.patternKey;
    if (patternKey) {
      let value = event.target.type === 'checkbox' ? event.target.checked : event.target.type === 'number' ? Number(event.target.value) : event.target.value;
      if (patternKey === 'id') value = cleanId(value);
      pattern[patternKey] = value;
      if (patternKey === 'duration') pattern.emitters.forEach(e => { e.end = Math.min(e.end, value); });
      normalizeAndRestart();
      $('#patternId').value = pattern.id; $('#patternDuration').value = pattern.duration;
      return;
    }
    const emitterKey = event.target.dataset.emitterKey;
    if (emitterKey) {
      const emitter = selectedEmitter(); if (!emitter) return;
      const oldId = emitter.id;
      let value = event.target.type === 'checkbox' ? event.target.checked : event.target.type === 'number' ? Number(event.target.value) : event.target.value;
      if (emitterKey === 'id') value = uniqueId(value, oldId);
      emitter[emitterKey] = value;
      if (emitterKey === 'id') selectedId = value;
      normalizeAndRestart();
    }
  });

  $('#addEmitter').addEventListener('click', () => {
    const emitter = presetEmitter($('#emitterPreset').value, pattern.emitters.length, pattern.duration);
    emitter.id = uniqueId(emitter.id); pattern.emitters.push(emitter); selectedId = emitter.id; normalizeAndRestart();
  });
  $('#duplicateEmitter').addEventListener('click', () => {
    const source = selectedEmitter(); if (!source) return;
    const clone = structuredClone(source); clone.id = uniqueId(`${source.id}-copy`); clone.name = `${source.name} 복사`; pattern.emitters.push(clone); selectedId = clone.id; normalizeAndRestart();
  });
  $('#deleteEmitter').addEventListener('click', () => {
    const index = pattern.emitters.findIndex(item => item.id === selectedId); if (index < 0) return;
    pattern.emitters.splice(index, 1); selectedId = pattern.emitters[Math.min(index, pattern.emitters.length - 1)]?.id || null; normalizeAndRestart();
  });
  $('#newPattern').addEventListener('click', () => { if (!dirty || confirm('저장하지 않은 변경을 버리고 새 패턴을 만들까요?')) loadIntoUi(defaultPattern(), false); });
  $('#savePattern').addEventListener('click', savePattern);
  $('#exportJson').addEventListener('click', exportJson);
  $('#importJson').addEventListener('click', () => $('#fileInput').click());
  $('#fileInput').addEventListener('change', async event => {
    const file = event.target.files[0]; if (!file) return;
    try { const data = JSON.parse(await file.text()); const errors = BarrageRuntime.validate(data); if (errors.length) throw new Error(errors.join(' ')); loadIntoUi(data, false); }
    catch (error) { setStatus(`가져오기 실패: ${error.message}`, 'error'); }
    event.target.value = '';
  });
  $('#testInGame').addEventListener('click', async () => {
    if (!(await savePattern())) return;
    location.href = `../index.html?debug&barrage=${encodeURIComponent(pattern.id)}&diff=${difficulty}`;
  });
  $('#refreshLibrary').addEventListener('click', () => refreshLibrary());
  $('#patternLibrary').addEventListener('change', event => loadPattern(event.target.value));
  $('#restart').addEventListener('click', restartPreview);
  $('#playPause').addEventListener('click', () => { playing = !playing; $('#playPause').textContent = playing ? 'Ⅱ' : '▶'; });
  $('#previewSpeed').addEventListener('change', event => { previewSpeed = Number(event.target.value); });
  $('#previewDifficulty').addEventListener('change', event => { difficulty = Number(event.target.value); restartPreview(); renderTimeline(); });
  $('#timeScrub').addEventListener('input', event => { playing = false; $('#playPause').textContent = '▶'; seekPreview(event.target.value); });

  canvas.addEventListener('pointerdown', event => {
    const point = canvasPoint(event);
    dragTarget = Math.hypot(point.x - boss.x, point.y - boss.y) < 70 ? boss : player;
    Object.assign(dragTarget, point); canvas.setPointerCapture(event.pointerId);
  });
  canvas.addEventListener('pointermove', event => {
    if (!dragTarget) return; const point = canvasPoint(event);
    dragTarget.x = Math.max(10, Math.min(950, point.x)); dragTarget.y = Math.max(10, Math.min(530, point.y));
  });
  canvas.addEventListener('pointerup', () => { dragTarget = null; });
  canvas.addEventListener('pointercancel', () => { dragTarget = null; });

  function frame(now) {
    const rawDt = Math.min(0.05, (now - lastFrame) / 1000); lastFrame = now;
    if (playing && runner) {
      const dt = rawDt * previewSpeed;
      runner.update(dt, context()); updateBullets(dt);
      if (runner.finished) { playing = false; $('#playPause').textContent = '▶'; }
      updateTimeUi();
      if (Math.floor(now / 250) !== Math.floor((now - rawDt * 1000) / 250)) {
        const compiled = BarrageRuntime.compile(pattern);
        $('#previewStats').textContent = `발사 ${compiled.events.length}회/주기 · 화면 탄 ${bullets.length} · 피격 ${hitCount}`;
      }
    }
    draw(); requestAnimationFrame(frame);
  }

  const draft = readJsonStorage(DRAFT_KEY, null);
  let lastPatternId = null;
  try { lastPatternId = localStorage.getItem(LAST_PATTERN_KEY); } catch (_) { /* 저장소 비활성 */ }
  const remembered = lastPatternId ? localPatterns()[lastPatternId] : null;
  const initial = draft || remembered || globalThis.BARRAGE_PATTERN_DATA?.['pangpang-needle-fan'] || defaultPattern();
  loadIntoUi(initial, !draft);
  if (draft) setStatus('닫기 전 초안을 자동 복구함', 'dirty');
  refreshLibrary(initial.id);
  if ('serviceWorker' in navigator && location.protocol !== 'file:') {
    navigator.serviceWorker.register('barrage-sw.js').catch(() => {});
  }
  requestAnimationFrame(frame);
})();
