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
  assert.equal(first.events.length, 213);
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
    'js/stage/entry.js',
    'js/stage/registry.js',
    'js/stage/path.js',
    'js/stage/formation.js',
    'js/stage/compiler.js',
    'js/stage/simulation.js',
    'js/stage/document.js',
    'js/stage/persistence.js',
    'tools/stage-sequencer.js',
  ];
  for (const script of required) assert.ok(html.includes(script), `${script}가 도구 페이지에 연결되어야 한다`);
  assert.ok(html.indexOf('js/stage/path.js') < html.indexOf('js/stage/compiler.js'));
  assert.ok(html.indexOf('js/stage/entry.js') < html.indexOf('js/stage/compiler.js'));
  assert.ok(html.indexOf('js/stage/formation.js') < html.indexOf('js/stage/compiler.js'));
  assert.ok(html.indexOf('js/stage/compiler.js') < html.indexOf('tools/stage-sequencer.js'));
  assert.ok(html.includes('<title>픽셀 파도 — 스테이지 시퀀서 M3</title>'));
  assert.ok(html.includes('id="markRangeIn"'));
  assert.ok(html.includes('id="markRangeOut"'));
  assert.ok(html.includes('id="addWave"'));
  assert.ok(html.includes('id="undoEdit"'));
  assert.ok(html.includes('id="importStageFile"'));
  assert.ok(html.includes('class="difficulty-legend"'));
  assert.ok(html.includes('id="activeDifficultyOnlyOption"'));
  assert.ok(html.includes('tools/stage-sequencer.js?v=6'));
  const sequencer = fs.readFileSync(path.join(root, 'tools/stage-sequencer.js'), 'utf8');
  assert.ok(sequencer.includes('data-difficulty-action="disable"'));
  assert.ok(sequencer.includes("pluginId === 'turtle-ride'"));
  assert.ok(sequencer.includes('name="ringCount"'));
  assert.ok(sequencer.includes('name="hp" type="number" min="0.1" max="1000000" step="0.1"'));
  assert.ok(sequencer.includes('name="interval" type="number" min="0" max="30" step="0.01"'));
  assert.ok(sequencer.includes('data-path-action="add"'));
  assert.ok(sequencer.includes("canvas.addEventListener('pointerdown', beginPathDrag)"));
  assert.ok(sequencer.includes("replaceDifficultyItem(authored.id, drag.working"));
  assert.ok(sequencer.includes('data-formation-resolved-count'));
  assert.ok(sequencer.includes("canvas.addEventListener('pointerdown', beginFormationDrag)"));
  assert.ok(sequencer.includes("'v-spread': 'V 편대 간격 조정'"));
  assert.ok(sequencer.includes("definitionOptionList('enemyKinds'"));
  assert.ok(sequencer.includes('ensureWaveDependencies(candidate'));
  assert.ok(sequencer.includes("drag.coordinate === 'x' ? '진입 X 이동'"));
  assert.ok(sequencer.includes('validateStageCandidate(candidate)'));
  const serviceWorker = fs.readFileSync(path.join(root, 'tools/stage-sequencer-sw.js'), 'utf8');
  assert.ok(serviceWorker.includes('../js/stage/document.js'));
  assert.ok(serviceWorker.includes('../js/stage/persistence.js'));
  assert.ok(serviceWorker.includes('../js/stage/path.js'));
  assert.ok(serviceWorker.includes('../js/stage/entry.js'));
  assert.ok(serviceWorker.includes('../js/stage/formation.js'));
  assert.ok(serviceWorker.includes('pixel-wave-stage-sequencer-m3-v3'));
}

console.log('stage runtime: ok', results);
