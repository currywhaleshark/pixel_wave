(function initStageSequencer() {
  'use strict';

  const STAGE_URL = 'docs/stage-editor/stage3.v1.draft.json';
  const PIXELS_PER_SECOND = 8;
  const TRACKS = [
    { id: 'environment', label: '환경', types: ['environment'], color: '#55d9e8' },
    { id: 'gimmick', label: '특수', types: ['gimmick', 'hazard'], color: '#ffd66e' },
    { id: 'wave', label: '잡몹', types: ['wave'], color: '#ff87bd' },
    { id: 'cue', label: '연출', types: ['cue'], color: '#ff8f8f' },
    { id: 'boss', label: '보스', types: ['boss'], color: '#8fa3e8' },
  ];
  const SECTION_COLORS = ['#55d9e8', '#ffd66e', '#ff87bd', '#8fa3e8', '#7dffd8'];
  const EDITABLE_TYPES = new Set(['wave', 'environment', 'cue']);
  const $ = selector => document.querySelector(selector);
  const canvas = $('#preview');
  const ctx = canvas.getContext('2d');

  let rawStage = null;
  let sourceStage = null;
  let stageDocument = null;
  let compiled = null;
  let simulation = null;
  let selectedId = null;
  let playing = false;
  let previewSpeed = 1;
  let range = { id: 'full', name: '전체', start: 0, end: 120 };
  let lastFrame = performance.now();
  let lastFollow = 0;
  let sourceHash = null;
  let exportedHash = null;
  let deviceSavedHash = null;
  let autosaveTimer = 0;
  let toastTimer = 0;
  let clipDrag = null;

  function escapeHtml(value) {
    return String(value ?? '')
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#39;');
  }

  function formatTime(value) {
    const time = Math.max(0, Number(value) || 0);
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    const hundredths = Math.floor((time % 1) * 100 + 1e-6);
    return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}.${String(hundredths).padStart(2, '0')}`;
  }

  function itemSummary(item) {
    if (!item) return '-';
    if (item.type === 'wave') {
      const payload = item.payload;
      return `${payload.enemy.kind} ×${item.resolvedCount ?? payload.spawn?.count ?? '?'} · ${payload.formation.presetId} · ${payload.movement.presetId} · ${payload.weapon.presetId || payload.weapon.patternId}`;
    }
    if (item.type === 'boss') return `boss: ${item.payload.bossId}`;
    if (item.type === 'terrain-object') return `terrain object: ${item.payload.objectId}`;
    return item.payload?.pluginId || item.type;
  }

  function setStatus(text, kind = '') {
    const badge = $('#validationBadge');
    badge.textContent = text;
    badge.className = `status ${kind}`;
  }

  function stageHash(stage = rawStage) {
    return StageRandom.hashString(JSON.stringify(stage)).toString(16).padStart(8, '0');
  }

  function toast(message) {
    const element = $('#editorToast');
    element.textContent = message;
    element.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => element.classList.remove('show'), 2200);
  }

  function updateEditorUi() {
    const item = stageDocument?.findItem(selectedId);
    $('#undoEdit').disabled = !stageDocument?.canUndo;
    $('#redoEdit').disabled = !stageDocument?.canRedo;
    $('#duplicateItem').disabled = !item || !EDITABLE_TYPES.has(item.type);
    $('#deleteItem').disabled = !item || !EDITABLE_TYPES.has(item.type) || item.id === 's3-scroll-base';
    if (!stageDocument) return;
    const hash = stageDocument.stateHash();
    const state = $('#draftState');
    const unexported = hash !== exportedHash;
    state.classList.toggle('unexported', unexported);
    if (hash === sourceHash) state.textContent = '원본';
    else if (hash !== deviceSavedHash) state.textContent = '저장 중';
    else state.textContent = unexported ? '기기 저장 · 미내보냄' : '내보냄 완료';
  }

  function scheduleAutosave() {
    if (!stageDocument) return;
    clearTimeout(autosaveTimer);
    updateEditorUi();
    autosaveTimer = setTimeout(async () => {
      const expectedHash = stageDocument.stateHash();
      try {
        await StagePersistence.saveDraft(stageDocument.stage, { exportedHash });
        if (stageDocument.stateHash() === expectedHash) deviceSavedHash = expectedHash;
        updateEditorUi();
      } catch (error) {
        console.error(error);
        toast('기기 자동저장에 실패했습니다');
      }
    }, 500);
  }

  function compileAtDifficulty(difficulty, preserveTime = 0) {
    setStatus('컴파일 중', 'loading');
    rawStage = stageDocument?.stage || rawStage;
    compiled = StageCompiler.compile(rawStage, { difficulty });
    simulation = new StageSimulation.Simulation(compiled, { fixedStep: 1 / 60, snapshotInterval: 5 });
    const snapshotCount = simulation.buildSnapshotCache();
    simulation.seek(Math.min(preserveTime, compiled.timeline.duration));
    setStatus(`검증 완료 · 스냅샷 ${snapshotCount}`, '');
    renderTimeline();
    selectItem(selectedId, false);
    updateUi();
    updateEditorUi();
  }

  async function loadStage() {
    try {
      const response = await fetch(STAGE_URL, { cache: 'no-cache' });
      if (!response.ok) throw new Error(`Stage JSON HTTP ${response.status}`);
      sourceStage = await response.json();
      const report = StageCompiler.validate(sourceStage);
      if (report.errors.length) throw new Error(report.errors.join('\n'));
      const stored = await StagePersistence.loadDraft(sourceStage.id);
      let initialStage = sourceStage;
      if (stored?.stage) {
        const storedReport = StageCompiler.validate(stored.stage);
        if (!storedReport.errors.length) initialStage = stored.stage;
      }
      stageDocument = new StageDocument.DocumentSession(initialStage);
      rawStage = stageDocument.stage;
      sourceHash = stageHash(sourceStage);
      exportedHash = stored?.exportedHash || sourceHash;
      deviceSavedHash = stored?.stage ? stageDocument.stateHash() : sourceHash;
      $('#stageName').textContent = rawStage.name;
      $('#timeScrub').max = rawStage.timeline.duration;
      range = { id: 'full', name: '전체', start: 0, end: rawStage.timeline.duration };
      compileAtDifficulty($('#previewDifficulty').value, 0);
      renderSectionButtons();
      $('#exportStage').disabled = false;
      $('#loadingOverlay').classList.add('hidden');
      playing = true;
      updatePlayButton();
      updateEditorUi();
      if (stored?.stage && initialStage === stored.stage) toast('기기에 저장된 초안을 복구했습니다');
    } catch (error) {
      console.error(error);
      setStatus('불러오기 실패', 'error');
      $('#loadingOverlay').textContent = `Stage 3을 불러오지 못했습니다: ${error.message}`;
    }
  }

  function renderSectionButtons() {
    const container = $('#sectionButtons');
    const sections = [{ id: 'full', name: '전체', start: 0, end: rawStage.timeline.duration }, ...rawStage.sections];
    container.innerHTML = '';
    for (const section of sections) {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = `section-button ${section.id === range.id ? 'active' : ''}`;
      button.textContent = section.name;
      button.addEventListener('click', () => setRange(section));
      container.appendChild(button);
    }
  }

  function setRange(section) {
    range = { id: section.id, name: section.name, start: section.start, end: section.end };
    simulation.seek(range.start);
    renderSectionButtons();
    updateUi(true);
  }

  function markCustomRange(edge) {
    if (!simulation || !compiled) return;
    const duration = compiled.timeline.duration;
    const at = Math.max(0, Math.min(duration, simulation.time));
    let start = range.start;
    let end = range.end;
    if (edge === 'in') {
      start = Math.min(at, duration - 0.1);
      if (end <= start + 0.1) end = Math.min(duration, start + 5);
    } else {
      end = Math.max(0.1, at);
      if (start >= end - 0.1) start = Math.max(0, end - 5);
    }
    range = { id: 'custom', name: '사용자 구간', start, end };
    renderSectionButtons();
    updateUi(false);
  }

  function layoutItems(items) {
    const laneEnds = [];
    return items.map(item => {
      const visualDuration = Math.max(item.timing.duration, item.type === 'wave' ? 0.8 : 0.5);
      let lane = laneEnds.findIndex(end => item.timing.start >= end + 0.12);
      if (lane < 0) lane = laneEnds.length;
      laneEnds[lane] = item.timing.start + visualDuration;
      return { item, lane };
    });
  }

  function beginClipDrag(event, item, clip) {
    const authored = stageDocument?.findItem(item.id);
    if (!authored || !EDITABLE_TYPES.has(authored.type) || event.button !== 0) return;
    clipDrag = {
      pointerId: event.pointerId,
      clip,
      itemId: item.id,
      startX: event.clientX,
      originalStart: authored.timing.start,
      nextStart: authored.timing.start,
      duration: authored.timing.duration,
      moved: false,
    };
    clip.setPointerCapture(event.pointerId);
    selectItem(item.id, false);
    playing = false;
    updatePlayButton();
  }

  function moveClipDrag(event) {
    if (!clipDrag || clipDrag.pointerId !== event.pointerId) return;
    const pixels = event.clientX - clipDrag.startX;
    if (!clipDrag.moved && Math.abs(pixels) < 6) return;
    event.preventDefault();
    clipDrag.moved = true;
    const delta = Math.round(pixels / PIXELS_PER_SECOND * 10) / 10;
    clipDrag.nextStart = Math.max(0, Math.min(
      rawStage.timeline.duration - clipDrag.duration,
      clipDrag.originalStart + delta,
    ));
    clipDrag.clip.classList.add('dragging');
    clipDrag.clip.style.left = `${clipDrag.nextStart * PIXELS_PER_SECOND}px`;
  }

  function endClipDrag(event) {
    if (!clipDrag || clipDrag.pointerId !== event.pointerId) return;
    const drag = clipDrag;
    clipDrag = null;
    drag.clip.classList.remove('dragging');
    if (event.type === 'pointercancel') {
      renderTimeline();
      return;
    }
    if (!drag.moved) return;
    drag.clip.dataset.dragged = 'true';
    setTimeout(() => { delete drag.clip.dataset.dragged; }, 0);
    const item = stageDocument.findItem(drag.itemId);
    if (!item || Math.abs(drag.nextStart - drag.originalStart) < 1e-9) {
      renderTimeline();
      return;
    }
    const next = StageDocument.clone(item);
    next.timing.start = drag.nextStart;
    replaceAuthoredItem(item.id, next, '클립 시간 이동');
  }

  function renderTimeline() {
    if (!compiled) return;
    const width = compiled.timeline.duration * PIXELS_PER_SECOND;
    const timelineCanvas = $('#timelineCanvas');
    timelineCanvas.style.setProperty('--timeline-width', `${width}px`);

    const ruler = $('#timelineRuler');
    ruler.innerHTML = '';
    for (let at = 0; at <= compiled.timeline.duration; at += 10) {
      const mark = document.createElement('span');
      mark.className = 'ruler-mark';
      mark.style.left = `${at * PIXELS_PER_SECOND}px`;
      mark.textContent = `${at}s`;
      ruler.appendChild(mark);
    }

    const sectionLayer = $('#timelineSections');
    sectionLayer.innerHTML = '';
    compiled.sections.forEach((section, index) => {
      const band = document.createElement('div');
      band.className = 'section-band';
      band.style.left = `${section.start * PIXELS_PER_SECOND}px`;
      band.style.width = `${Math.max(1, (section.end - section.start) * PIXELS_PER_SECOND)}px`;
      band.style.setProperty('--section-color', SECTION_COLORS[index % SECTION_COLORS.length]);
      band.textContent = section.name;
      sectionLayer.appendChild(band);
    });

    const tracks = $('#timelineTracks');
    tracks.innerHTML = '';
    for (const track of TRACKS) {
      const trackItems = compiled.items.filter(item => track.types.includes(item.type));
      const layout = layoutItems(trackItems);
      const laneCount = Math.max(1, ...layout.map(entry => entry.lane + 1));
      const row = document.createElement('div');
      row.className = 'timeline-track';
      const label = document.createElement('div');
      label.className = 'track-label';
      label.textContent = `${track.label} ${trackItems.length}`;
      const lane = document.createElement('div');
      lane.className = 'track-lane';
      lane.style.height = `${Math.max(35, laneCount * 28 + 7)}px`;
      lane.addEventListener('click', event => {
        if (event.target !== lane) return;
        const rect = lane.getBoundingClientRect();
        simulation.seek((event.clientX - rect.left) / rect.width * compiled.timeline.duration);
        playing = false;
        updatePlayButton();
        updateUi(true);
      });
      for (const { item, lane: laneIndex } of layout) {
        const clip = document.createElement('button');
        const durationWidth = item.timing.duration * PIXELS_PER_SECOND;
        clip.type = 'button';
        clip.className = `timeline-clip ${item.timing.duration === 0 ? 'instant' : ''} ${item.id === selectedId ? 'selected' : ''}`;
        clip.dataset.itemId = item.id;
        clip.style.left = `${item.timing.start * PIXELS_PER_SECOND}px`;
        clip.style.top = `${5 + laneIndex * 28}px`;
        clip.style.width = `${Math.max(item.timing.duration === 0 ? 11 : 16, durationWidth)}px`;
        clip.style.setProperty('--clip-color', track.color);
        clip.title = `${item.name} · ${item.timing.start.toFixed(2)}초 · ${itemSummary(item)}`;
        if (item.timing.duration > 0) clip.textContent = item.name;
        clip.addEventListener('pointerdown', event => beginClipDrag(event, item, clip));
        clip.addEventListener('pointermove', moveClipDrag);
        clip.addEventListener('pointerup', endClipDrag);
        clip.addEventListener('pointercancel', endClipDrag);
        clip.addEventListener('click', event => {
          event.stopPropagation();
          if (clip.dataset.dragged) return;
          selectItem(item.id, true);
          simulation.seek(item.timing.start);
          playing = false;
          updatePlayButton();
          updateUi(true);
        });
        lane.appendChild(clip);
      }
      row.append(label, lane);
      tracks.appendChild(row);
    }
  }

  function optionList(values, selected) {
    return (values || []).map(value => `<option value="${escapeHtml(value)}" ${value === selected ? 'selected' : ''}>${escapeHtml(value)}</option>`).join('');
  }

  function validateReplacement(id, nextItem) {
    const candidate = stageDocument.snapshot();
    const index = candidate.items.findIndex(item => item.id === id);
    if (index < 0) throw new Error(`클립 '${id}'을 찾을 수 없습니다.`);
    candidate.items[index] = nextItem;
    const report = StageCompiler.validate(candidate);
    if (report.errors.length) throw new Error(report.errors[0]);
    StageCompiler.compile(candidate, { difficulty: $('#previewDifficulty').value });
  }

  function afterDocumentChange(label, focusId = selectedId, seekAt = simulation?.time || 0) {
    rawStage = stageDocument.stage;
    selectedId = stageDocument.findItem(focusId) ? focusId : null;
    $('#stageName').textContent = rawStage.name;
    $('#timeScrub').max = rawStage.timeline.duration;
    compileAtDifficulty($('#previewDifficulty').value, seekAt);
    renderSectionButtons();
    scheduleAutosave();
    toast(label);
  }

  function replaceAuthoredItem(id, nextItem, label) {
    try {
      validateReplacement(id, nextItem);
      if (stageDocument.replaceItem(id, nextItem, label)) {
        afterDocumentChange(label, nextItem.id, nextItem.timing.start);
        return true;
      }
    } catch (error) {
      console.error(error);
      toast(`수정할 수 없습니다: ${error.message}`);
    }
    return false;
  }

  function commitInspectorForm(form) {
    const item = stageDocument.findItem(form.dataset.itemId);
    if (!item) return;
    const values = new FormData(form);
    const next = StageDocument.clone(item);
    next.name = String(values.get('name') || next.name).trim() || next.name;
    next.timing.start = Math.max(0, Number(values.get('start')) || 0);
    next.timing.duration = Math.max(0, Number(values.get('duration')) || 0);

    if (next.type === 'wave') {
      const count = Math.max(1, Math.round(Number(values.get('count')) || 1));
      let interval = Math.max(0, Number(values.get('interval')) || 0);
      const formationId = String(values.get('formation'));
      if (formationId === 'v' || formationId === 'wall-gap') interval = 0;
      next.payload.enemy.kind = String(values.get('enemyKind'));
      next.payload.enemy.hp = Math.max(0.1, Number(values.get('hp')) || 1);
      next.payload.enemy.speed = Math.max(0, Number(values.get('speed')) || 0);
      next.payload.spawn.count = count;
      next.payload.spawn.interval = interval;
      next.payload.entry.y = Math.max(0, Math.min(1, Number(values.get('y')) || 0));
      next.payload.formation.presetId = formationId;
      next.payload.movement.presetId = String(values.get('movement'));
      next.payload.weapon.presetId = String(values.get('weapon'));
      next.timing.duration = formationId === 'wall-gap' ? 0 : (count - 1) * interval;
    } else if (next.type === 'environment' && next.payload?.pluginId === 'scroll-speed') {
      const multiplier = Math.max(0, Math.min(5, Number(values.get('scrollMultiplier')) || 0));
      next.payload.params.curve = next.payload.params.curve.map(point => ({ ...point, value: multiplier }));
    } else if (next.type === 'cue' && next.payload?.params) {
      next.payload.params.message = String(values.get('message') || '');
      next.payload.params.color = String(values.get('color') || '#ff8f8f');
    }
    next.timing.start = Math.max(0, Math.min(next.timing.start, rawStage.timeline.duration - next.timing.duration));
    replaceAuthoredItem(item.id, next, '클립 수정');
  }

  function nudgeSelected(delta) {
    const item = stageDocument?.findItem(selectedId);
    if (!item || !EDITABLE_TYPES.has(item.type)) return;
    const next = StageDocument.clone(item);
    next.timing.start = Math.max(0, Math.min(
      rawStage.timeline.duration - next.timing.duration,
      next.timing.start + delta,
    ));
    replaceAuthoredItem(item.id, next, `${delta > 0 ? '+' : ''}${delta}초 이동`);
  }

  function bindInspectorForm() {
    const form = $('#clipEditForm');
    if (form) form.addEventListener('submit', event => {
      event.preventDefault();
      commitInspectorForm(form);
    });
    document.querySelectorAll('[data-nudge]').forEach(button => button.addEventListener('click', () => nudgeSelected(Number(button.dataset.nudge))));
  }

  function selectItem(id, openInspector = true) {
    selectedId = compiled?.items.some(item => item.id === id) ? id : null;
    document.querySelectorAll('.timeline-clip').forEach(clip => clip.classList.toggle('selected', clip.dataset.itemId === selectedId));
    const item = compiled?.items.find(entry => entry.id === selectedId);
    if (!item) {
      $('#selectedName').textContent = '클립을 선택하세요';
      $('#selectedTiming').textContent = '클립을 선택하세요';
      $('#inspectorBody').innerHTML = '<div class="empty-inspector">타임라인 클립을 선택하면 시간을 옮기고 속성을 편집할 수 있습니다.</div>';
      updateEditorUi();
      return;
    }
    const authored = stageDocument.findItem(item.id);
    const editable = !!authored && EDITABLE_TYPES.has(authored.type);
    $('#selectedName').textContent = item.name;
    $('#selectedTiming').textContent = `${item.timing.start.toFixed(2)}초 · ${item.type}`;
    let fields = '';
    if (editable) {
      const durationReadonly = authored.type === 'wave' ? 'readonly' : '';
      fields = `
        <form id="clipEditForm" class="inspector-form" data-item-id="${escapeHtml(authored.id)}">
          <label>클립 이름<input name="name" maxlength="80" value="${escapeHtml(authored.name)}" required></label>
          <div class="form-row two">
            <label>시작(초)<input name="start" type="number" min="0" max="${rawStage.timeline.duration}" step="0.05" value="${authored.timing.start}" required></label>
            <label>길이(초)<input name="duration" type="number" min="0" max="${rawStage.timeline.duration}" step="0.05" value="${authored.timing.duration}" ${durationReadonly} required></label>
          </div>
          <div class="nudge-tools" aria-label="클립 시간 이동">
            <button type="button" data-nudge="-1">−1초</button><button type="button" data-nudge="-0.1">−0.1</button>
            <button type="button" data-nudge="0.1">+0.1</button><button type="button" data-nudge="1">+1초</button>
          </div>
          ${authored.type === 'wave' ? `
            <div class="form-row three">
              <label>적<select name="enemyKind">${optionList(rawStage.dependencies.enemyKinds, authored.payload.enemy.kind)}</select></label>
              <label>체력<input name="hp" type="number" min="0.1" max="1000000" step="1" value="${authored.payload.enemy.hp}"></label>
              <label>속도<input name="speed" type="number" min="0" max="2000" step="1" value="${authored.payload.enemy.speed}"></label>
            </div>
            <div class="form-row three">
              <label>마릿수<input name="count" type="number" min="1" max="256" step="1" value="${authored.resolvedCount ?? authored.payload.spawn.count ?? 1}"></label>
              <label>간격<input name="interval" type="number" min="0" max="30" step="0.05" value="${authored.payload.spawn.interval ?? 0}"></label>
              <label>높이<input name="y" type="number" min="0" max="1" step="0.05" value="${authored.payload.entry.y ?? 0.5}"></label>
            </div>
            <label>편대<select name="formation">${optionList(rawStage.dependencies.formationPresets, authored.payload.formation.presetId)}</select></label>
            <label>이동<select name="movement">${optionList(rawStage.dependencies.movementPresets, authored.payload.movement.presetId)}</select></label>
            <label>사격<select name="weapon">${optionList(rawStage.dependencies.weaponPresets, authored.payload.weapon.presetId)}</select></label>
          ` : ''}
          ${authored.type === 'environment' && authored.payload?.pluginId === 'scroll-speed' ? `
            <label>배경 스크롤 배율<input name="scrollMultiplier" type="number" min="0" max="5" step="0.05" value="${authored.payload.params.curve[0]?.value ?? 1}"></label>
          ` : ''}
          ${authored.type === 'cue' && authored.payload?.params ? `
            <label>표시 문구<input name="message" value="${escapeHtml(authored.payload.params.message || '')}"></label>
            <label>표시 색상<input name="color" type="color" value="${escapeHtml(authored.payload.params.color || '#ff8f8f')}"></label>
          ` : ''}
          <div class="inspector-actions"><button class="accent" type="submit">수정 적용</button></div>
        </form>`;
    } else {
      fields = '<div class="readonly-notice">이 클립은 M2 첫 단계에서 읽기 전용입니다. 잡몹·환경·연출 클립부터 편집을 엽니다.</div>';
    }
    $('#inspectorBody').innerHTML = `
      <div class="inspector-grid">
        <div class="info-card"><small>종류</small><strong>${escapeHtml(item.type)}</strong></div>
        <div class="info-card"><small>시간</small><strong>${item.timing.start.toFixed(2)}–${(item.timing.start + item.timing.duration).toFixed(2)}초</strong></div>
        <div class="info-card"><small>난이도</small><strong>${escapeHtml(compiled.difficulty.name)}</strong></div>
        <div class="info-card"><small>컴파일 결과</small><strong>${escapeHtml(itemSummary(item))}</strong></div>
      </div>
      ${fields}
      <details><summary>원본 payload JSON</summary><pre class="payload-summary">${escapeHtml(JSON.stringify(authored?.payload || item.payload, null, 2))}</pre></details>`;
    bindInspectorForm();
    updateEditorUi();
    if (openInspector && matchMedia('(max-width: 980px)').matches) setInspectorOpen(true);
  }

  function setInspectorOpen(open) {
    $('#inspector').classList.toggle('open', open);
    $('#inspectorToggle').setAttribute('aria-expanded', String(open));
  }

  function updatePlayButton() {
    $('#playPause').textContent = playing ? 'Ⅱ' : '▶';
    $('#playPause').title = playing ? '일시정지' : '재생';
  }

  function currentSection() {
    if (!compiled) return null;
    return compiled.sections.find(section => simulation.time >= section.start && simulation.time < section.end)
      || compiled.sections[compiled.sections.length - 1];
  }

  function updateUi(follow = false) {
    if (!simulation) return;
    const stats = simulation.stats();
    $('#timeLabel').textContent = `${formatTime(simulation.time)} / ${formatTime(compiled.timeline.duration)}`;
    $('#timeScrub').value = simulation.time;
    $('#timelinePlayhead').style.transform = `translateX(${simulation.time * PIXELS_PER_SECOND}px)`;
    $('#rangeLabel').textContent = `${range.name} ${range.start.toFixed(1)}–${range.end.toFixed(1)}초`;
    $('#previewMode').textContent = range.id === 'full' ? '전체 미리보기' : '구간 반복';
    $('#sectionLabel').textContent = currentSection()?.name || compiled.metadata.name;
    $('#previewStats').textContent = `적 ${stats.enemies} · 탄 ${stats.bullets} · 누적 ${stats.spawnedEnemyCount}/${compiled.resolvedEnemyCount} · ${stats.stateHash}`;
    if (follow && performance.now() - lastFollow > 180) {
      const viewport = $('#timelineViewport');
      const x = simulation.time * PIXELS_PER_SECOND;
      const labelWidth = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--timeline-label')) || 84;
      const visibleLeft = viewport.scrollLeft + labelWidth;
      const visibleRight = viewport.scrollLeft + viewport.clientWidth;
      if (x + labelWidth < visibleLeft + 30 || x + labelWidth > visibleRight - 40) {
        viewport.scrollLeft = Math.max(0, x - viewport.clientWidth * 0.35);
      }
      lastFollow = performance.now();
    }
  }

  function drawFallbackBackground() {
    const gradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
    gradient.addColorStop(0, '#128da8');
    gradient.addColorStop(0.5, '#0a5f91');
    gradient.addColorStop(1, '#073768');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }

  function drawSpeedLines() {
    if (!simulation.ride) return;
    ctx.save();
    ctx.strokeStyle = 'rgba(190,245,255,0.34)';
    ctx.lineWidth = 2;
    const local = simulation.time - simulation.ride.start;
    for (let index = 0; index < 20; index++) {
      const y = (index * 73 + 31) % canvas.height;
      const x = ((index * 127 - local * 650) % (canvas.width + 220) + canvas.width + 220) % (canvas.width + 220) - 110;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + 90 + index % 4 * 24, y);
      ctx.stroke();
    }
    ctx.restore();
  }

  function drawFallbackEnemy(enemy) {
    ctx.save();
    ctx.translate(enemy.x, enemy.y);
    ctx.fillStyle = enemy.kind === 'big' ? '#d98a6a' : enemy.kind === 'ray' ? '#7189d8' : '#ffab5e';
    if (enemy.kind === 'ray') {
      ctx.beginPath(); ctx.moveTo(-20, 0); ctx.lineTo(8, -16); ctx.lineTo(22, 0); ctx.lineTo(8, 16); ctx.closePath(); ctx.fill();
    } else {
      ctx.beginPath(); ctx.ellipse(0, 0, enemy.kind === 'big' ? 26 : 11, enemy.kind === 'big' ? 18 : 7, 0, 0, Math.PI * 2); ctx.fill();
    }
    ctx.restore();
  }

  function renderPreview() {
    drawFallbackBackground();
    if (simulation && typeof Backgrounds !== 'undefined') {
      Backgrounds.draw(ctx, {
        stageIdx: 2,
        state: 'play',
        scroll: simulation.scroll,
        stageT: simulation.time,
        stormScale: 1,
      });
    }
    if (!simulation) return;
    drawSpeedLines();

    for (const pearl of simulation.pearls) {
      if (!Sprites.draw(ctx, 'pearl.small', pearl.x, pearl.y, { t: pearl.age })) {
        ctx.fillStyle = '#fff4c4'; ctx.beginPath(); ctx.arc(pearl.x, pearl.y, 4, 0, Math.PI * 2); ctx.fill();
      }
    }
    for (const bullet of simulation.bullets) {
      if (!Sprites.draw(ctx, `bullet.${bullet.kind}`, bullet.x, bullet.y, { t: bullet.age })) {
        ctx.fillStyle = bullet.kind === 'spike' ? '#ffd6e8' : '#b9ebff'; ctx.beginPath(); ctx.arc(bullet.x, bullet.y, bullet.radius, 0, Math.PI * 2); ctx.fill();
      }
    }
    for (const enemy of simulation.enemies) {
      const selected = enemy.itemId === selectedId;
      if (!Sprites.draw(ctx, `enemy.${enemy.kind}`, enemy.x, enemy.y, {
        t: enemy.age,
        flipX: enemy.directionX > 0,
        outline: selected ? '#ffffff' : undefined,
        outlineAlpha: selected ? 0.9 : undefined,
      })) drawFallbackEnemy(enemy);
    }

    if (simulation.ride?.params?.drawTurtle) Sprites.draw(ctx, 'turtle.taxi', simulation.player.x, simulation.player.y + 20, { t: simulation.time });
    if (!Sprites.draw(ctx, 'mermaid.swim', simulation.player.x, simulation.player.y, { t: simulation.time })) {
      ctx.fillStyle = '#ff9ed2'; ctx.beginPath(); ctx.arc(simulation.player.x, simulation.player.y, 15, 0, Math.PI * 2); ctx.fill();
    }
    if (simulation.boss) {
      if (!Sprites.draw(ctx, 'boss.ssing', simulation.boss.x, simulation.boss.y, { t: simulation.boss.age })) {
        ctx.fillStyle = '#8fa3e8'; ctx.beginPath(); ctx.ellipse(simulation.boss.x, simulation.boss.y, 56, 36, 0, 0, Math.PI * 2); ctx.fill();
      }
    }

    if (simulation.warningUntil > simulation.time) {
      const flash = 0.7 + Math.sin(simulation.time * 10) * 0.3;
      ctx.save();
      ctx.fillStyle = `rgba(255,80,115,${0.06 * flash})`;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = '#ff9aaa';
      ctx.font = "bold 24px 'Galmuri11', monospace";
      ctx.textAlign = 'center';
      ctx.fillText('!! 뭔가 다가온다 !!', canvas.width / 2, 94);
      ctx.restore();
    }
    const messages = simulation.messages.slice(-2);
    messages.forEach((message, index) => {
      ctx.save();
      ctx.fillStyle = message.color || '#fff';
      ctx.font = "16px 'Galmuri11', monospace";
      ctx.textAlign = 'center';
      ctx.fillText(message.text, canvas.width / 2, canvas.height - 56 + index * 24);
      ctx.restore();
    });
    if (selectedId) {
      const item = compiled.items.find(entry => entry.id === selectedId);
      if (item) {
        ctx.save();
        ctx.fillStyle = 'rgba(3,17,35,0.78)';
        ctx.fillRect(12, canvas.height - 38, Math.min(520, 30 + item.name.length * 17), 26);
        ctx.fillStyle = '#fff';
        ctx.font = "12px 'Galmuri11', monospace";
        ctx.textAlign = 'left';
        ctx.fillText(item.name, 22, canvas.height - 20);
        ctx.restore();
      }
    }
  }

  function tick(now) {
    const elapsed = Math.min(0.1, Math.max(0, (now - lastFrame) / 1000));
    lastFrame = now;
    if (simulation && playing) {
      const targetEnd = range.end;
      simulation.advance(elapsed * previewSpeed);
      if (simulation.time >= targetEnd - 1e-6) {
        if (range.id === 'full') {
          simulation.seek(targetEnd);
          playing = false;
          updatePlayButton();
        } else {
          simulation.seek(range.start);
        }
      }
      updateUi(true);
    }
    renderPreview();
    requestAnimationFrame(tick);
  }

  function createWaveFromForm(form) {
    const values = new FormData(form);
    const count = Math.max(1, Math.round(Number(values.get('count')) || 1));
    const interval = Math.max(0, Number(values.get('interval')) || 0);
    const duration = (count - 1) * interval;
    const start = Math.max(0, Math.min(rawStage.timeline.duration - duration, Number(values.get('start')) || 0));
    const enemyKind = String(values.get('enemyKind'));
    const defaults = {
      fish: { hp: 2, speed: 150 },
      ray: { hp: 4, speed: 150 },
      big: { hp: 48, speed: 105 },
    }[enemyKind] || { hp: 2, speed: 150 };
    return {
      id: stageDocument.uniqueId(`${rawStage.id}-wave`),
      type: 'wave',
      name: String(values.get('name') || '새 잡몹 웨이브').trim() || '새 잡몹 웨이브',
      enabled: true,
      timing: { domain: 'time', start, duration },
      payload: {
        enemy: { kind: enemyKind, hp: defaults.hp, speed: defaults.speed },
        spawn: { count, interval },
        entry: { presetId: 'right-to-left', y: Math.max(0, Math.min(1, Number(values.get('y')) || 0.5)) },
        formation: { presetId: 'column' },
        movement: { presetId: 'straight' },
        weapon: { presetId: 'none' },
      },
    };
  }

  function addWaveFromDialog(form) {
    try {
      const item = createWaveFromForm(form);
      const candidate = stageDocument.snapshot();
      candidate.items.push(item);
      const report = StageCompiler.validate(candidate);
      if (report.errors.length) throw new Error(report.errors[0]);
      StageCompiler.compile(candidate, { difficulty: $('#previewDifficulty').value });
      const inserted = stageDocument.insertItem(item, stageDocument.stage.items.length, '잡몹 웨이브 추가');
      $('#addWaveDialog').close();
      afterDocumentChange('잡몹 웨이브를 추가했습니다', inserted.id, inserted.timing.start);
    } catch (error) {
      console.error(error);
      toast(`추가할 수 없습니다: ${error.message}`);
    }
  }

  function duplicateSelected() {
    const item = stageDocument?.findItem(selectedId);
    if (!item || !EDITABLE_TYPES.has(item.type)) return;
    try {
      const copy = stageDocument.duplicateItem(item.id, { startOffset: 1 });
      afterDocumentChange('클립을 복제했습니다', copy.id, copy.timing.start);
    } catch (error) {
      console.error(error);
      toast(`복제할 수 없습니다: ${error.message}`);
    }
  }

  function deleteSelected() {
    const item = stageDocument?.findItem(selectedId);
    if (!item || !EDITABLE_TYPES.has(item.type) || item.id === 's3-scroll-base') return;
    const removedName = item.name;
    stageDocument.removeItem(item.id);
    selectedId = null;
    afterDocumentChange(`'${removedName}' 삭제 · undo 가능`, null, simulation?.time || 0);
  }

  function undoEdit() {
    const label = stageDocument?.undo();
    if (label) afterDocumentChange(`실행 취소: ${label}`, selectedId, simulation?.time || 0);
  }

  function redoEdit() {
    const label = stageDocument?.redo();
    if (label) afterDocumentChange(`다시 실행: ${label}`, selectedId, simulation?.time || 0);
  }

  async function importStageFile(file) {
    if (!file) return;
    try {
      const imported = JSON.parse(await file.text());
      const report = StageCompiler.validate(imported);
      if (report.errors.length) throw new Error(report.errors[0]);
      if (sourceStage && imported.id !== sourceStage.id) throw new Error(`M2는 아직 '${sourceStage.id}' 문서만 편집합니다.`);
      StageCompiler.compile(imported, { difficulty: $('#previewDifficulty').value });
      stageDocument = new StageDocument.DocumentSession(imported);
      rawStage = stageDocument.stage;
      sourceStage = StageDocument.clone(imported);
      sourceHash = stageDocument.stateHash();
      exportedHash = sourceHash;
      deviceSavedHash = sourceHash;
      selectedId = null;
      range = { id: 'full', name: '전체', start: 0, end: rawStage.timeline.duration };
      $('#stageName').textContent = rawStage.name;
      $('#timeScrub').max = rawStage.timeline.duration;
      compileAtDifficulty($('#previewDifficulty').value, 0);
      renderSectionButtons();
      await StagePersistence.saveDraft(rawStage, { exportedHash });
      toast(`${file.name}을 가져왔습니다`);
    } catch (error) {
      console.error(error);
      toast(`JSON을 가져올 수 없습니다: ${error.message}`);
    } finally {
      $('#importStageFile').value = '';
    }
  }

  async function exportStage() {
    if (!rawStage) return;
    const text = JSON.stringify(rawStage, null, 2) + '\n';
    const filename = `pixel-wave-${rawStage.id}.v1.json`;
    const file = new File([text], filename, { type: 'application/json' });
    let completed = false;
    if (navigator.share && navigator.canShare?.({ files: [file] })) {
      try {
        await navigator.share({ title: rawStage.name, files: [file] });
        completed = true;
      } catch (error) {
        if (error.name === 'AbortError') return;
      }
    }
    if (!completed) {
      const url = URL.createObjectURL(file);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      completed = true;
    }
    if (completed) {
      exportedHash = stageDocument.stateHash();
      const saved = await StagePersistence.saveDraft(rawStage, { exportedHash });
      deviceSavedHash = stageHash(saved.stage);
      updateEditorUi();
      toast('Stage JSON을 내보냈습니다');
    }
  }

  $('#restart').addEventListener('click', () => {
    simulation?.seek(range.start);
    updateUi(true);
  });
  $('#playPause').addEventListener('click', () => {
    if (!simulation) return;
    if (!playing && simulation.time >= range.end - 1e-6) simulation.seek(range.start);
    playing = !playing;
    updatePlayButton();
  });
  $('#timeScrub').addEventListener('input', event => {
    if (!simulation) return;
    simulation.seek(Number(event.target.value));
    updateUi(false);
  });
  $('#timeScrub').addEventListener('pointerdown', () => { playing = false; updatePlayButton(); });
  $('#previewSpeed').addEventListener('change', event => { previewSpeed = Number(event.target.value) || 1; });
  $('#previewDifficulty').addEventListener('change', event => {
    if (!rawStage) return;
    const time = simulation?.time || 0;
    compileAtDifficulty(event.target.value, time);
  });
  $('#markRangeIn').addEventListener('click', () => markCustomRange('in'));
  $('#markRangeOut').addEventListener('click', () => markCustomRange('out'));
  $('#addWave').addEventListener('click', () => {
    if (!simulation) return;
    const form = $('#addWaveForm');
    form.elements.start.value = Math.min(rawStage.timeline.duration, simulation.time).toFixed(2);
    $('#addWaveDialog').showModal();
  });
  $('#addWaveForm').addEventListener('submit', event => {
    event.preventDefault();
    addWaveFromDialog(event.currentTarget);
  });
  document.querySelectorAll('[data-dialog-close]').forEach(button => button.addEventListener('click', () => $('#addWaveDialog').close()));
  $('#duplicateItem').addEventListener('click', duplicateSelected);
  $('#deleteItem').addEventListener('click', deleteSelected);
  $('#undoEdit').addEventListener('click', undoEdit);
  $('#redoEdit').addEventListener('click', redoEdit);
  $('#importStage').addEventListener('click', () => $('#importStageFile').click());
  $('#importStageFile').addEventListener('change', event => importStageFile(event.target.files?.[0]));
  $('#inspectorToggle').addEventListener('click', () => setInspectorOpen(!$('#inspector').classList.contains('open')));
  $('#exportStage').addEventListener('click', exportStage);
  document.addEventListener('keydown', event => {
    const typing = event.target instanceof Element && event.target.closest('input, select, textarea');
    if (!(event.ctrlKey || event.metaKey) || typing) return;
    if (event.key.toLowerCase() !== 'z') return;
    event.preventDefault();
    if (event.shiftKey) redoEdit();
    else undoEdit();
  });

  if ('serviceWorker' in navigator) navigator.serviceWorker.register('tools/stage-sequencer-sw.js').catch(() => {});
  loadStage();
  requestAnimationFrame(tick);
})();
