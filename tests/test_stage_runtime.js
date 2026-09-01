'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const StageCompiler = require('../js/stage/compiler.js');
const { Simulation } = require('../js/stage/simulation.js');

const root = path.resolve(__dirname, '..');
const stagePath = path.join(root, 'docs/stage-editor/stage3.v1.draft.json');
const source = JSON.parse(fs.readFileSync(stagePath, 'utf8'));

function closeTo(actual, expected, epsilon = 1e-6) {
  assert.ok(Math.abs(actual - expected) <= epsilon, `${actual} is not within ${epsilon} of ${expected}`);
}

{
  const report = StageCompiler.validate(source);
  assert.deepEqual(report.errors, [], 'Stage 3 초안은 M1 계약을 통과해야 한다');
  assert.ok(report.warnings.includes('초안 Stage JSON입니다.'));
}

const results = [];
const formationByDifficulty = [];
for (const difficulty of ['easy', 'normal', 'hard']) {
  const first = StageCompiler.compile(source, { difficulty });
  const second = StageCompiler.compile(source, { difficulty });

  assert.equal(first.compileHash, second.compileHash, `${difficulty} 컴파일은 결정론적이어야 한다`);
  assert.equal(first.items.length, 41);
  assert.equal(first.events.length, 219, '택시 구간의 두 후방 추월 경고를 포함한다');
  assert.equal(first.resolvedEnemyCount, 207);
  assert.equal(new Set(first.events.map(event => event.id)).size, first.events.length, '이벤트 id는 고유해야 한다');
  assert.equal(first.items.find(item => item.id === 's3-w029').resolvedCount, 8, '벽 편대는 빈 칸 두 개를 제외한다');
  formationByDifficulty.push(first.events
    .filter(event => event.itemId === 's3-w029')
    .map(event => [event.enemy.wallSlot, event.enemy.y]));

  const simulation = new Simulation(first, { fixedStep: 1 / 60, snapshotInterval: 5 });
  assert.equal(simulation.buildSnapshotCache(), 24, '0–115초의 5초 스냅샷을 만든다');

  simulation.seek(57);
  closeTo(simulation.scroll, 6525);
  const firstSeekHash = simulation.stateHash();
  simulation.seek(83.25);
  simulation.seek(57);
  assert.equal(simulation.stateHash(), firstSeekHash, '캐시에서 같은 시각으로 seek하면 상태가 같아야 한다');

  simulation.seek(120);
  const stats = simulation.stats();
  closeTo(stats.scroll, 9360);
  assert.equal(stats.spawnedEnemyCount, 207);
  assert.equal(simulation.boss?.id, 'ssing');
  assert.equal(simulation.boss?.itemId, first.items.find(item => item.type === 'boss')?.id);
  results.push({ difficulty, firedBulletCount: stats.firedBulletCount, stateHash: stats.stateHash });

  const singleFrame = new Simulation(first, { fixedStep: 1 / 60 });
  const manyFrames = new Simulation(first, { fixedStep: 1 / 60 });
  singleFrame.advance(10);
  for (let frame = 0; frame < 600; frame++) manyFrames.advance(1 / 60);
  assert.equal(manyFrames.stateHash(), singleFrame.stateHash(), '렌더 프레임 cadence가 시뮬레이션 결과를 바꾸면 안 된다');
}

assert.ok(results[0].firedBulletCount < results[1].firedBulletCount);
assert.ok(results[1].firedBulletCount < results[2].firedBulletCount);
assert.equal(new Set(results.map(result => result.stateHash)).size, 3, '난이도별 최종 상태가 구별되어야 한다');
assert.deepEqual(formationByDifficulty[0], formationByDifficulty[1], '난이도를 바꿔도 명시적으로 바꾸지 않은 편대 시드는 유지된다');
assert.deepEqual(formationByDifficulty[1], formationByDifficulty[2]);

{
  require('../js/stages.generated.js');
  const bossIds = ['pangpang', 'mongsil', 'ssing', 'chorong', 'buu', 'ureu', 'hwii'];
  const enemyCounts = [185, 193, 207, 145, 139, 187, 191];
  for (let index = 0; index < bossIds.length; index++) {
    const stage = global.STAGE_DATA_REGISTRY[`stage${index + 1}`];
    const full = StageCompiler.compile(stage, { difficulty: 'easy' });
    const fullSimulation = new Simulation(full, { fixedStep: 1 / 60 }).seek(full.timeline.duration);
    assert.equal(fullSimulation.stats().spawnedEnemyCount, enemyCounts[index]);
    assert.equal(fullSimulation.boss?.id, bossIds[index]);
  }
}

{
  const patched = StageCompiler.clone(source);
  patched.items.find(item => item.id === 's3-w001').difficulty = {
    hard: {
      mode: 'patch',
      patch: {
        timing: { duration: 1.44 },
        payload: { spawn: { count: 7 } },
      },
    },
  };
  assert.equal(StageCompiler.compile(patched, { difficulty: 'easy' }).items.find(item => item.id === 's3-w001').resolvedCount, 6);
  assert.equal(StageCompiler.compile(patched, { difficulty: 'hard' }).items.find(item => item.id === 's3-w001').resolvedCount, 7);

  patched.items.find(item => item.id === 's3-w001').difficulty.hard.patch.payload.movement = { presetId: 'missing-preset' };
  assert.throws(
    () => StageCompiler.compile(patched, { difficulty: 'hard' }),
    /선언하지 않은 movementPresets 'missing-preset'/,
    '난이도 패치가 적용된 뒤에도 레지스트리를 다시 검증해야 한다',
  );
}

{
  const invalid = StageCompiler.clone(source);
  invalid.dependencies.enemyKinds = invalid.dependencies.enemyKinds.filter(id => id !== 'fish');
  const report = StageCompiler.validate(invalid);
  assert.ok(report.errors.some(error => error.includes("선언하지 않은 enemyKinds 'fish'")));
}

{
  const html = fs.readFileSync(path.join(root, 'tools/stage-sequencer.html'), 'utf8');
  const required = [
    'js/stage/random.js',
    'js/stage/layerTransform.js',
    'js/stage/terrain.js',
    'js/stage/entry.js',
    'js/stage/path.js',
    'js/stage/formation.js',
    'js/stage/wreck.js',
    'js/stage/plugin.js',
    'js/stage/enemyState.js',
    'js/stage/registry.js',
    'js/stage/behavior.js',
    'js/stage/barrage.js',
    'js/stage/budget.js',
    'js/stage/compiler.js',
    'js/stage/simulation.js',
    'js/stage/document.js',
    'js/stage/persistence.js',
    'tools/stage-sequencer.js',
  ];
  for (const script of required) assert.ok(html.includes(script), `${script}가 도구 페이지에 연결되어야 한다`);
  assert.ok(html.indexOf('js/stage/path.js') < html.indexOf('js/stage/compiler.js'));
  assert.ok(html.indexOf('js/stage/plugin.js') < html.indexOf('js/stage/registry.js'));
  assert.ok(html.indexOf('js/stage/enemyState.js') < html.indexOf('js/stage/compiler.js'));
  assert.ok(html.indexOf('js/stage/entry.js') < html.indexOf('js/stage/compiler.js'));
  assert.ok(html.indexOf('js/stage/formation.js') < html.indexOf('js/stage/compiler.js'));
  assert.ok(html.indexOf('js/stage/behavior.js') < html.indexOf('js/stage/compiler.js'));
  assert.ok(html.indexOf('js/stage/barrage.js') < html.indexOf('js/stage/compiler.js'));
  assert.ok(html.indexOf('js/stage/budget.js') < html.indexOf('js/stage/simulation.js'));
  assert.ok(html.indexOf('js/stage/plugin.js') < html.indexOf('js/stage/compiler.js'));
  assert.ok(html.indexOf('js/stage/compiler.js') < html.indexOf('tools/stage-sequencer.js'));
  assert.ok(html.includes('<title>픽셀 파도 — 스테이지 시퀀서 M7</title>'));
  assert.ok(html.includes('M7 · AUTHORING READY'));
  assert.ok(html.includes('id="markRangeIn"'));
  assert.ok(html.includes('id="markRangeOut"'));
  assert.ok(html.includes('id="addWave"'));
  assert.ok(html.includes('id="undoEdit"'));
  assert.ok(html.includes('id="importStageFile"'));
  assert.ok(html.includes('class="difficulty-legend"'));
  assert.ok(html.includes('id="activeDifficultyOnlyOption"'));
  assert.ok(html.includes('id="gameTestLink"'));
  assert.ok(html.includes('id="stagePicker"'));
  assert.ok(html.includes('id="multiSelect"'));
  assert.ok(html.includes('id="saveSectionTemplate"'));
  assert.ok(html.includes('id="schemaNotice"'));
  assert.ok(html.includes('tools/stage-sequencer.css?v=2'));
  assert.ok(html.includes('js/stage/document.js?v=4'));
  assert.ok(html.includes('tools/stage-sequencer.js?v=27'));
  assert.ok(html.includes('js/stage/previewPlacement.js?v=1'));
  const sequencer = fs.readFileSync(path.join(root, 'tools/stage-sequencer.js'), 'utf8');
  assert.ok(sequencer.includes('function updateGameTestLink()'));
  assert.ok(sequencer.includes('function prepareGameTest(event)'));
  assert.ok(sequencer.includes('function consumeGameTestResult()'));
  assert.ok(sequencer.includes("format: 'pixel-wave-stage-test'"));
  assert.ok(sequencer.includes('function copySelected()'));
  assert.ok(sequencer.includes('function saveSectionTemplate()'));
  assert.ok(sequencer.includes("addEventListener('beforeunload'"));
  assert.ok(sequencer.includes('data-difficulty-action="disable"'));
  assert.ok(sequencer.includes("pluginId === 'turtle-ride'"));
  assert.ok(sequencer.includes('name="ringCount"'));
  assert.ok(sequencer.includes('name="hp" type="number" min="0.1" max="1000000" step="0.1"'));
  assert.ok(sequencer.includes('name="interval" type="number" min="0" max="30" step="0.01"'));
  assert.ok(sequencer.includes('data-path-action="add"'));
  assert.ok(sequencer.includes("canvas.addEventListener('pointerdown', beginPathDrag)"));
  assert.ok(sequencer.includes("replaceDifficultyItem(authored.id, drag.working"));
  assert.ok(sequencer.includes('data-formation-resolved-count'));
  assert.ok(sequencer.includes('name="rearWarningEnabled"'));
  assert.ok(sequencer.includes('name="rearWarningLead"'));
  assert.ok(sequencer.includes('function drawEntryWarnings()'));
  assert.ok(sequencer.includes('name="taxiDurability"'));
  assert.ok(sequencer.includes('name="continueIntoBoss"'));
  assert.ok(sequencer.includes('name="clearBulletsOnStart"'));
  assert.ok(sequencer.includes('name="trailEnabled"'));
  assert.ok(sequencer.includes('name="ringEnabled"'));
  assert.ok(sequencer.includes("canvas.addEventListener('pointerdown', beginFormationDrag)"));
  assert.ok(sequencer.includes('function previewSpriteHitTargets()'));
  assert.ok(sequencer.includes('function selectPreviewSprite(event)'));
  assert.ok(sequencer.includes("canvas.addEventListener('pointerdown', selectPreviewSprite)"));
  assert.ok(sequencer.includes('function renderMultiInspector(authoredItems, openInspector)'));
  assert.ok(sequencer.includes('function commitMultiInspectorForm(form)'));
  assert.ok(sequencer.includes('data-batch-field'));
  assert.ok(sequencer.includes('혼합값은 그대로 유지됩니다'));
  assert.ok(sequencer.includes("'v-spread': 'V 편대 간격 조정'"));
  assert.ok(sequencer.includes("definitionOptionList('enemyKinds'"));
  assert.ok(sequencer.includes('data-enemy-param-section'));
  assert.ok(sequencer.includes('function readEnemyParams('));
  assert.ok(sequencer.includes("type: 'u-turn'"));
  assert.ok(sequencer.includes("'u-turn': '유턴 위치 이동'"));
  assert.ok(sequencer.includes('function drawUTurnCue('));
  assert.ok(sequencer.includes("definitionOptionList('movementPresets'"));
  assert.ok(sequencer.includes("definitionOptionList('weaponPresets'"));
  assert.ok(sequencer.includes('data-behavior-section'));
  assert.ok(sequencer.includes('data-barrage-action="edit"'));
  assert.ok(sequencer.includes('applyBarrageReturn()'));
  assert.ok(sequencer.includes('updateBudgetOverlay(stats)'));
  assert.ok(sequencer.includes('data-curve-editor'));
  assert.ok(sequencer.includes('function beginCurveDrag(event)'));
  assert.ok(sequencer.includes("commitScopedItem(authored, next, '스크롤 곡선 점 추가')"));
  assert.ok(sequencer.includes('renderGenericPluginEditor(formItem)'));
  assert.ok(sequencer.includes('function renderChannelConflicts()'));
  assert.ok(sequencer.includes('function drawPluginBackdrop()'));
  assert.ok(sequencer.includes('function drawPluginForeground()'));
  assert.ok(sequencer.includes('function drawTerrainReviewOverlay()'));
  assert.ok(sequencer.includes('function handleTerrainReviewPointer(event)'));
  assert.ok(sequencer.includes("stage1: 'docs/stage-editor/stage1.v1.draft.json'"));
  assert.ok(sequencer.includes('step="0.001" value="${formItem.timing.duration}"'));
  assert.ok(sequencer.includes("stage7: 'docs/stage-editor/stage7.v1.draft.json'"));
  assert.ok(sequencer.includes('ensureWaveDependencies(candidate'));
  assert.ok(sequencer.includes("drag.coordinate === 'x' ? '진입 X 이동'"));
  assert.ok(sequencer.includes('validateStageCandidate(candidate)'));
  const serviceWorker = fs.readFileSync(path.join(root, 'tools/stage-sequencer-sw.js'), 'utf8');
  assert.ok(serviceWorker.includes('../js/stage/document.js'));
  assert.ok(serviceWorker.includes('../js/stage/persistence.js'));
  assert.ok(serviceWorker.includes('../js/stage/path.js'));
  assert.ok(serviceWorker.includes('../js/stage/entry.js'));
  assert.ok(serviceWorker.includes('../js/stage/formation.js'));
  assert.ok(serviceWorker.includes('../js/stage/behavior.js'));
  assert.ok(serviceWorker.includes('../js/stage/barrage.js'));
  assert.ok(serviceWorker.includes('../js/stage/budget.js'));
  assert.ok(serviceWorker.includes('../js/stage/plugin.js'));
  assert.ok(serviceWorker.includes('../js/stage/wreck.js'));
  assert.ok(serviceWorker.includes('../js/stage/enemyState.js'));
  assert.ok(serviceWorker.includes('../js/stage/layerTransform.js'));
  assert.ok(serviceWorker.includes('../js/stage/terrain.js'));
  assert.ok(serviceWorker.includes('pixel-wave-stage-sequencer-m7-v12'));
  assert.ok(serviceWorker.includes('../js/stage/previewPlacement.js'));
  assert.ok(serviceWorker.includes('stage5.v1.draft.json'));
  assert.ok(serviceWorker.includes('assets/backgrounds/stage6-near-strip.png'));
}

console.log('stage runtime: ok', results);
