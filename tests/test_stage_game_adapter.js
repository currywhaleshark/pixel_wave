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
assert.ok(indexHtml.includes('js/stages.generated.js?v=8'));
assert.ok(indexHtml.includes('js/boss3.js?v=4'));
assert.ok(indexHtml.includes('js/boss5.js?v=6'));
assert.ok(indexHtml.includes('js/stage/enemyState.js?v=1'));
assert.ok(indexHtml.includes('js/stage/wreck.js?v=1'));
assert.ok(indexHtml.includes('js/entities.js?v=13'));
assert.ok(indexHtml.includes('js/stage/layerTransform.js?v=2'));
assert.ok(indexHtml.includes('js/stage/plugin.js?v=8'));
assert.ok(indexHtml.includes('js/stage/gameAdapter.js?v=11'));
assert.ok(indexHtml.indexOf('js/stage/compiler.js') < indexHtml.indexOf('js/stage/gameAdapter.js'));
const mainSource = fs.readFileSync(path.join(root, 'js/main.js'), 'utf8');
assert.ok(mainSource.includes("stageTestParams.get('stageRuntime') === 'data'"));
assert.ok(mainSource.includes('STAGES.findIndex(stage => stage.id === testStageId)'));
assert.ok(mainSource.includes("this.stageRuntimeMode = dataSpawner ? 'data' : 'legacy'"));
assert.ok(mainSource.includes("finishStageTest(reason = 'complete')"));
assert.ok(mainSource.includes('applyStageRuntimeState(state)'));
assert.ok(mainSource.includes("sampleStageCurrent(targetId = 'player')"));
assert.ok(mainSource.includes('spawnBolt(xFrac, options = {})'));
assert.ok(mainSource.includes('addStageEntryWarning(warning)'));
assert.ok(mainSource.includes('drawEntryWarnings()'));
assert.ok(mainSource.includes('startRide(dur, options = {})'));
assert.ok(mainSource.includes('absorbRideHit()'));
assert.ok(mainSource.includes('(this.boss.lureR ?? 150) * lurePower'));
assert.ok(mainSource.includes("typeof b.enterSurvival === 'function'"));
assert.ok(mainSource.includes("finishRide('boss')"));
assert.ok(mainSource.includes("if (e.kind === 'wreck')"));
assert.ok(mainSource.includes('const nearestX = Math.max(e.x - halfWidth'));

assert.equal(Adapter.CONFIG.defaultMode, 'legacy');
assert.equal(Adapter.requestedMode('?debug&stageRuntime=data'), 'data');
assert.equal(Adapter.requestedMode('?stageRuntime=data'), 'legacy', 'debug 없는 프로덕션 URL은 데이터 런타임을 켜면 안 된다');

const expected = [
  [34, 185, 0, 0, 110, 114], [38, 193, 0, 0, 110, 114], [37, 207, 0, 0, 116, 120],
  [35, 145, 0, 0, 111, 115], [25, 139, 10, 0, 111, 115],
  [32, 177, 0, 13, 111, 115], [34, 191, 2, 6, 111, 115],
];
assert.deepEqual(Adapter.CONFIG.optInStageIds, ['stage1', 'stage2', 'stage3', 'stage4', 'stage5', 'stage6', 'stage7']);
for (let stageIndex = 0; stageIndex < timelines.length; stageIndex++) {
  for (let difficulty = 0; difficulty < 3; difficulty++) {
    const report = Adapter.parityReport(`stage${stageIndex + 1}`, timelines[stageIndex], difficulty);
    if (stageIndex === 0) {
      assert.equal(report.ok, false, '재구성 중인 Stage 1은 legacy와 다른 점을 명시적으로 보고한다');
      for (const id of ['s1-w015', 's1-w027', 's1-w029', 's1-w030']) {
        assert.ok(report.errors.some(error => error.includes(id)), `${id}의 의도적 교체가 parity report에 남아야 한다`);
      }
    } else if (stageIndex === 1) {
      assert.equal(report.ok, false, '재구성 중인 Stage 2는 legacy와 다른 점을 명시적으로 보고한다');
      assert.ok(report.errors.some(error => error.includes('s2-w008')), '초기 기뢰 학습 구간의 이동이 parity report에 남아야 한다');
    } else if (stageIndex === 3) {
      assert.equal(report.ok, false, '재구성 중인 Stage 4는 legacy와 다른 점을 명시적으로 보고한다');
      for (const id of ['s4-w007', 's4-w026', 's4-w034']) {
        assert.ok(report.errors.some(error => error.includes(id)), `${id}의 의도적 교체가 parity report에 남아야 한다`);
      }
    } else if (stageIndex === 4) {
      assert.equal(report.ok, false, '재구성 중인 Stage 5는 legacy와 다른 점을 명시적으로 보고한다');
      for (const id of ['s5-w004', 's5-w015', 's5-w018']) {
        assert.ok(report.errors.some(error => error.includes(id)), `${id}의 의도적 교체가 parity report에 남아야 한다`);
      }
    } else if (stageIndex === 5) {
      assert.equal(report.ok, false, '재구성 중인 Stage 6은 legacy와 다른 점을 명시적으로 보고한다');
      assert.ok(report.errors.some(error => error.includes('s6-w015')), '제거한 대물 웨이브가 parity report에 남아야 한다');
      assert.ok(report.errors.some(error => error.includes('s6-w021')), '이동한 가오리 웨이브가 parity report에 남아야 한다');
      assert.ok(report.errors.some(error => error.includes('번개 수 16/13')), '재구성한 낙뢰 수가 parity report에 남아야 한다');
    } else assert.deepEqual(report.errors, [], `stage${stageIndex + 1}/${report.summary.difficulty}: ${report.errors.join(' / ')}`);
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
  startRide(duration, options) { this.rideStarts.push({ duration, options }); },
  startBossWarning() { this.warningCount++; },
  startBoss() { this.bossCount++; },
  message() {},
};
const spawner = Adapter.createSpawner('stage3', 0, fakeGame, legacy, '?debug&stageRuntime=data&stageRange=35,57');
assert.ok(spawner);
assert.equal(spawner.parity.ok, true);
spawner.seekRange(35);
spawner.update(35);
assert.equal(fakeGame.rideStarts[0].duration, 22);
assert.equal(fakeGame.rideStarts[0].options.scrollMultiplier, 5);
assert.equal(fakeGame.rideStarts[0].options.bulletClearOnStart.convertToPearls, true);
spawner.update(37);
assert.ok(fakeGame.enemies.length > 0);
spawner.update(57);
assert.equal(fakeGame.paused, true);

const rearWarningGame = {
  enemies: [], groups: {}, entryWarnings: [], player: { x: 180, y: 270 },
  startRide() {}, startBossWarning() {}, startBoss() {}, message() {},
  addStageEntryWarning(warning) { this.entryWarnings.push(warning); },
  clearStageEntryWarnings() { this.entryWarnings = []; },
};
const rearWarningSpawner = Adapter.createSpawner('stage3', 0, rearWarningGame, legacy, '?debug&stageRuntime=data');
rearWarningSpawner.seekRange(11);
assert.equal(rearWarningGame.entryWarnings.length, 1, '구간 중간 seek도 진행 중인 후방 경고를 복원한다');
assert.equal(rearWarningGame.entryWarnings[0].y, 270);

const editedStage = JSON.parse(JSON.stringify(global.STAGE_DATA_REGISTRY.stage3));
const editedWave = editedStage.items.find(item => item.id === 's3-w001');
editedWave.timing.start = 9.25;
editedWave.payload.enemy.params = { extensionValue: 7 };
editedWave.payload.movement.params.turnRate = 0.65;
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
assert.equal(testGame.enemies[0].params.extensionValue, 7, 'enemy.params를 실제 Enemy까지 전달한다');
assert.equal(testGame.enemies[0].movementParams.turnRate, 0.65, '이동 파라미터를 실제 Enemy까지 전달한다');
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
assert.equal(hazardGame.enemies[0].wreckW, 74);
assert.equal(hazardGame.enemies[0].x, 960 + 37 + 95 * 0.6);
assert.equal(hazardGame.enemies[0].wreckCueDuration, 0.6);
assert.equal(hazardGame.enemies[0].wreckIndestructible, true);
const stormSpawner = Adapter.createSpawner('stage6', 0, hazardGame, timelines[5], '?debug&stageRuntime=data');
stormSpawner.seekRange(14.9);
stormSpawner.update(15);
assert.deepEqual(hazardGame.bolts, [{
  value: 0.25,
  options: { width: 46, telegraphDuration: 0.9, strikeDuration: 0.4 },
}]);

const terrainGame = {
  enemies: [], groups: {}, scroll: 0, player: { x: 180, y: 270 },
  startRide() {}, startBossWarning() {}, startBoss() {}, spawnBolt() {}, message() {},
  applyStageRuntimeState(state) { this.stageRuntimeState = state; },
};
const terrainSpawner = Adapter.createSpawner('stage1', 0, terrainGame, timelines[0], '?debug&stageRuntime=data');
const firstTerrain = terrainSpawner.compiled.items.find(item => item.type === 'terrain-object');
terrainSpawner.seekRange(firstTerrain.projectedTime - 0.1);
terrainSpawner.update(firstTerrain.projectedTime);
const liveTerrain = terrainGame.enemies.find(enemy => enemy.kind === 'turret');
assert.ok(liveTerrain, '지형 포대가 실제 데이터 플레이의 Enemy로 생성된다');
assert.equal(liveTerrain.M, 6);
assert.equal(liveTerrain.ringN, 6);
assert.equal(liveTerrain.ringGapCount, 1);
assert.equal(liveTerrain.ringAuthoredGeometry, 1);
assert.ok(liveTerrain.x > 900 && liveTerrain.x < 1000);

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
const firstMineLantern = spawnAt('stage2', timelines[1], 16);
assert.equal(firstMineLantern.S, 4, '등불 기뢰 무기를 실제 S4로 연결한다');
assert.equal(firstMineLantern.mineFuseDuration, 3.4);
assert.equal(firstMineLantern.mineRingCount, 5);
assert.equal(firstMineLantern.mineRingPhase, 1.57);
assert.equal(firstMineLantern.mineAuthoredGeometry, 1);
const firstViper = spawnAt('stage4', timelines[3], 13);
assert.equal(firstViper.M, 5, '심해 추적 이동을 실제 M5로 연결한다');
assert.equal(firstViper.params.revealDelay, 0.75, '이지 독니고기는 일찍 드러나야 한다');
assert.equal(spawnAt('stage6', timelines[5], 2).M, 7, '폭풍 해류 이동을 실제 M7로 연결한다');
const surround = spawnAt('stage5', timelines[4], 66.5);
assert.equal(surround.M, 1);
assert.ok(Math.hypot(surround.x - 180, surround.y - 270) > 250, '포위 편대가 현재 플레이어 둘레에 생성된다');

delete global.Enemy;
console.log('stage game adapter: ok');
