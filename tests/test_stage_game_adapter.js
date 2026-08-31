'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
require('../js/stages.generated.js');
const Adapter = require('../js/stage/gameAdapter.js');

const wavesSource = fs.readFileSync(path.join(root, 'js/waves.js'), 'utf8');
const context = vm.createContext({ console, Math });
for (const boss of ['Boss', 'BossMongsil', 'BossSsing', 'BossChorong', 'BossBuu', 'BossUreu', 'BossHwii']) context[boss] = function BossStub() {};
vm.runInContext(`${wavesSource}\nglobalThis.__stage3Timeline = STAGE3_TIMELINE;`, context);
const legacy = context.__stage3Timeline;

const indexHtml = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
assert.ok(indexHtml.includes('js/stages.generated.js?v=1'));
assert.ok(indexHtml.includes('js/entities.js?v=5'));
assert.ok(indexHtml.includes('js/stage/gameAdapter.js?v=3'));
assert.ok(indexHtml.indexOf('js/stage/compiler.js') < indexHtml.indexOf('js/stage/gameAdapter.js'));
const mainSource = fs.readFileSync(path.join(root, 'js/main.js'), 'utf8');
assert.ok(mainSource.includes("stageTestParams.get('stageRuntime') === 'data'"));
assert.ok(mainSource.includes("this.stageRuntimeMode = dataSpawner ? 'data' : 'legacy'"));
assert.ok(mainSource.includes("finishStageTest(reason = 'complete')"));

assert.equal(Adapter.CONFIG.defaultMode, 'legacy');
assert.equal(Adapter.requestedMode('?debug&stageRuntime=data'), 'data');
assert.equal(Adapter.requestedMode('?stageRuntime=data'), 'legacy', 'debug 없는 프로덕션 URL은 데이터 런타임을 켜면 안 된다');

for (let difficulty = 0; difficulty < 3; difficulty++) {
  const report = Adapter.parityReport('stage3', legacy, difficulty);
  assert.deepEqual(report.errors, [], `${report.summary.difficulty}: ${report.errors.join(' / ')}`);
  assert.equal(report.summary.waves, 37);
  assert.equal(report.summary.enemies, 207);
  assert.equal(report.summary.warningAt, 116);
  assert.equal(report.summary.bossAt, 120);
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

delete global.Enemy;
console.log('stage game adapter: ok');
