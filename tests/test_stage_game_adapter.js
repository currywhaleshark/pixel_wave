'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
require('../js/stages.generated.js');
const Adapter = require('../js/stage/gameAdapter.js');
const { Simulation } = require('../js/stage/simulation.js');

const wavesSource = fs.readFileSync(path.join(root, 'js/waves.js'), 'utf8');
const context = vm.createContext({ console, Math });
for (const boss of ['Boss', 'BossMongsil', 'BossSsing', 'BossChorong', 'BossBuu', 'BossUreu', 'BossHwii']) context[boss] = function BossStub() {};
vm.runInContext(`${wavesSource}\nglobalThis.__stageTimelines = [
  STAGE1_TIMELINE, STAGE2_TIMELINE, STAGE3_TIMELINE, STAGE4_TIMELINE,
  STAGE5_TIMELINE, STAGE6_TIMELINE, STAGE7_TIMELINE,
];`, context);
const timelines = context.__stageTimelines;
const legacy = timelines[2];

const indexHtml = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
assert.ok(indexHtml.includes('js/stages.generated.js?v=2'));
assert.ok(indexHtml.includes('js/entities.js?v=7'));
assert.ok(indexHtml.includes('js/stage/layerTransform.js?v=2'));
assert.ok(indexHtml.includes('js/stage/plugin.js?v=4'));
assert.ok(indexHtml.includes('js/stage/gameAdapter.js?v=5'));
assert.ok(indexHtml.indexOf('js/stage/compiler.js') < indexHtml.indexOf('js/stage/gameAdapter.js'));
const mainSource = fs.readFileSync(path.join(root, 'js/main.js'), 'utf8');
assert.ok(mainSource.includes("stageTestParams.get('stageRuntime') === 'data'"));
assert.ok(mainSource.includes('STAGES.findIndex(stage => stage.id === testStageId)'));
assert.ok(mainSource.includes("this.stageRuntimeMode = dataSpawner ? 'data' : 'legacy'"));
assert.ok(mainSource.includes("finishStageTest(reason = 'complete')"));
assert.ok(mainSource.includes('applyStageRuntimeState(state)'));
assert.ok(mainSource.includes("sampleStageCurrent(targetId = 'player')"));
assert.ok(mainSource.includes('spawnBolt(xFrac, options = {})'));

assert.equal(Adapter.CONFIG.defaultMode, 'legacy');
assert.equal(Adapter.requestedMode('?debug&stageRuntime=data'), 'data');
assert.equal(Adapter.requestedMode('?stageRuntime=data'), 'legacy', 'debug 없는 프로덕션 URL은 데이터 런타임을 켜면 안 된다');

const expected = [
  [38, 189, 0, 0, 110, 114], [38, 193, 0, 0, 110, 114], [37, 207, 0, 0, 116, 120],
  [39, 170, 0, 0, 111, 115], [31, 162, 11, 0, 111, 115],
  [35, 187, 0, 16, 111, 115], [34, 191, 2, 6, 111, 115],
];
assert.deepEqual(Adapter.CONFIG.optInStageIds, ['stage1', 'stage2', 'stage3', 'stage4', 'stage5', 'stage6', 'stage7']);
for (let stageIndex = 0; stageIndex < timelines.length; stageIndex++) {
  for (let difficulty = 0; difficulty < 3; difficulty++) {
    const report = Adapter.parityReport(`stage${stageIndex + 1}`, timelines[stageIndex], difficulty);
    assert.deepEqual(report.errors, [], `stage${stageIndex + 1}/${report.summary.difficulty}: ${report.errors.join(' / ')}`);
    const [waves, enemies, wrecks, bolts, warningAt, bossAt] = expected[stageIndex];
    assert.deepEqual(
      [report.summary.waves, report.summary.enemies, report.summary.wrecks, report.summary.bolts, report.summary.warningAt, report.summary.bossAt],
      [waves, enemies, wrecks, bolts, warningAt, bossAt],
    );
  }
}

global.Enemy = class EnemyStub { constructor(spec) { Object.assign(this, spec); } };
const fakeGame = {
  enemies: [], groups: {}, rideStarts: [], warningCount: 0, bossCount: 0, paused: false,
  startRide(duration) { this.rideStarts.push(duration); },
  startBossWarning() { this.warningCount++; },
  startBoss() { this.bossCount++; },
  message() {},
};
const spawner = Adapter.createSpawner('stage3', 0, fakeGame, legacy, '?debug&stageRuntime=data&stageRange=35,57');
assert.ok(spawner);
assert.equal(spawner.parity.ok, true);
spawner.seekRange(35);
spawner.update(35);
assert.deepEqual(fakeGame.rideStarts, [22]);
spawner.update(37);
assert.ok(fakeGame.enemies.length > 0);
spawner.update(57);
assert.equal(fakeGame.paused, true);

const editedStage = JSON.parse(JSON.stringify(global.STAGE_DATA_REGISTRY.stage3));
const editedWave = editedStage.items.find(item => item.id === 's3-w001');
editedWave.timing.start = 9.25;
editedWave.payload.weapon = {
  patternId: 'pangpang-needle-fan',
  startDelay: 0.25,
  stopWhenLeaving: false,
};
editedStage.dependencies.barragePatterns.push('pangpang-needle-fan');
const payload = {
  format: 'pixel-wave-stage-test', schemaVersion: 1,
  stage: editedStage, stageHash: 'draft1234',
};
global.sessionStorage = {
  getItem(key) { return key === Adapter.TEST_STORAGE_KEY ? JSON.stringify(payload) : null; },
};
const testGame = {
  enemies: [], groups: {}, finished: null,
  startRide() {}, startBossWarning() {}, startBoss() {}, message() {},
  finishStageTest(reason) { this.finished = reason; },
};
const draftSpawner = Adapter.createSpawner(
  'stage3', 0, testGame, legacy,
  '?debug&stageRuntime=data&stageTest=1&stageRange=9,10&returnTo=%2Ftools%2Fstage-sequencer.html%3Fstage%3Dstage3',
);
assert.ok(draftSpawner.testMode);
assert.equal(draftSpawner.sourceHash, 'draft1234');
assert.equal(draftSpawner.returnUrl, '/tools/stage-sequencer.html?stage=stage3');
assert.equal(draftSpawner.compiled.items.find(item => item.id === 's3-w001').timing.start, 9.25);
assert.equal(draftSpawner.parity.ok, false, '편집 초안은 체크인된 legacy와 다른 점을 진단해야 한다');
draftSpawner.seekRange(9);
draftSpawner.update(10);
assert.ok(testGame.enemies.length > 0);
assert.equal(testGame.enemies[0].S, 0, '탄막 패턴은 기존 S축 무기로 잘못 변환하지 않는다');
assert.equal(testGame.enemies[0].barragePatternId, 'pangpang-needle-fan');
assert.equal(testGame.enemies[0].barragePattern.id, 'pangpang-needle-fan');
assert.equal(testGame.enemies[0].fireDelay, 0.25);
assert.equal(testGame.enemies[0].barrageStopWhenLeaving, false);
assert.equal(testGame.finished, 'range');
delete global.sessionStorage;

const hazardGame = {
  enemies: [], groups: {}, bolts: [],
  player: { x: 180, y: 270 },
  startRide() {}, startBossWarning() {}, startBoss() {}, message() {},
  applyStageRuntimeState(state) { this.stageRuntimeState = state; },
  spawnBolt(value, options) { this.bolts.push({ value, options }); },
};
const wreckSpawner = Adapter.createSpawner('stage5', 0, hazardGame, timelines[4], '?debug&stageRuntime=data');
wreckSpawner.seekRange(7.9);
wreckSpawner.update(8);
assert.equal(hazardGame.enemies[0].kind, 'wreck');
assert.equal(hazardGame.enemies[0].wreckH, 0.38 * 540);
const stormSpawner = Adapter.createSpawner('stage6', 0, hazardGame, timelines[5], '?debug&stageRuntime=data');
stormSpawner.seekRange(19.4);
stormSpawner.update(19.5);
assert.deepEqual(hazardGame.bolts, [{
  value: 0.42,
  options: { width: 46, telegraphDuration: 0.9, strikeDuration: 0.4 },
}]);

for (const [stageId, timeline, at] of [
  ['stage4', timelines[3], 20],
  ['stage6', timelines[5], 19.75],
]) {
  const game = {
    enemies: [], groups: {}, player: { x: 180, y: 270 },
    startRide() {}, startBossWarning() {}, startBoss() {}, spawnBolt() {}, message() {},
    applyStageRuntimeState(state) { this.stageRuntimeState = state; },
  };
  const dataSpawner = Adapter.createSpawner(stageId, 0, game, timeline, '?debug&stageRuntime=data');
  dataSpawner.seekRange(at);
  const preview = new Simulation(Adapter.compile(stageId, 0)).seek(at).pluginState;
  assert.ok(Math.abs(game.stageRuntimeState.darkness - preview.darkness) < 1e-9, `${stageId} 어둠 상태가 미리보기와 같아야 한다`);
  assert.ok(Math.abs(game.stageRuntimeState.current.x - preview.current.x) < 1e-9, `${stageId} X 해류가 미리보기와 같아야 한다`);
  assert.ok(Math.abs(game.stageRuntimeState.current.y - preview.current.y) < 1e-9, `${stageId} Y 해류가 미리보기와 같아야 한다`);
  assert.deepEqual(game.stageRuntimeState.influence, preview.influence, `${stageId} 대상별 해류 영향이 미리보기와 같아야 한다`);
}

function spawnAt(stageId, timeline, at) {
  const game = {
    enemies: [], groups: {}, player: { x: 180, y: 270 },
    startRide() {}, startBossWarning() {}, startBoss() {}, spawnBolt() {}, message() {},
  };
  const dataSpawner = Adapter.createSpawner(stageId, 0, game, timeline, '?debug&stageRuntime=data');
  dataSpawner.seekRange(at);
  dataSpawner.update(at);
  return game.enemies[0];
}
assert.equal(spawnAt('stage2', timelines[1], 22).S, 4, '등불 기뢰 무기를 실제 S4로 연결한다');
assert.equal(spawnAt('stage4', timelines[3], 15.5).M, 5, '심해 추적 이동을 실제 M5로 연결한다');
assert.equal(spawnAt('stage6', timelines[5], 2).M, 7, '폭풍 해류 이동을 실제 M7로 연결한다');
const surround = spawnAt('stage5', timelines[4], 41);
assert.equal(surround.M, 1);
assert.ok(Math.hypot(surround.x - 180, surround.y - 270) > 250, '포위 편대가 현재 플레이어 둘레에 생성된다');

delete global.Enemy;
console.log('stage game adapter: ok');
