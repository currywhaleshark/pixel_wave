'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
const context = vm.createContext({
  console,
  Math,
  Sound: { sfx() {} },
  Assets: { has() { return false; } },
  Pearl: class Pearl {},
  Sprites: { has() { return false; }, draw() { return false; } },
  SPRITES: {},
});

for (const file of ['js/config.js', 'js/stage/layerTransform.js', 'js/stage/enemyState.js', 'js/barragePatterns.generated.js', 'js/barrage.js', 'js/boss.js', 'js/entities.js']) {
  vm.runInContext(fs.readFileSync(path.join(root, file), 'utf8'), context, { filename: file });
}

function makeBossGame(diff) {
  return {
    barragePatternId: null,
    D: { bossInt: 1 },
    diff,
    player: { x: 100, y: 270 },
    dolphin: null,
    ebullets: [],
    pearls: [],
    spawner: { pending: [] },
    stageT: 0,
    aimedCalls: [],
    ringCalls: [],
    message() {},
    clearBulletsToPearls() {},
    addBattery() {},
    phaseReward() {},
    victory() {},
    bossAimed(...args) { this.aimedCalls.push(args); },
    bossRing(...args) { this.ringCalls.push(args); },
  };
}

context.game = makeBossGame(0);

const boss = vm.runInContext('new Boss(game)', context);
boss.phase = 1;
boss.x = 780;
boss.y = 270;

boss.update(1.49);
assert.equal(context.game.ebullets.length, 0, '첫 발사는 1.5초 예고 뒤여야 한다');
boss.update(0.02);
assert.equal(context.game.ebullets.length, 3, '팡팡 P1은 JSON의 조준 3발을 실제 적탄 배열에 넣는다');
assert.ok(context.game.ebullets.every(bullet => bullet.vx < 0), '플레이어 쪽인 왼쪽으로 발사한다');
assert.equal(context.game.aimedCalls.length, 0, '데이터 패턴 첫 발사를 코드 폴백이 대신하면 안 된다');
boss.update(1.2);
assert.equal(context.game.aimedCalls.length, 1, '이지 P1은 성긴 부채꼴 사이에 단발 조준 압박을 섞는다');

context.normalGame = makeBossGame(1);
const normalP2 = vm.runInContext('new Boss(normalGame)', context);
normalP2.phase = 2;
normalP2.fireT = 0;
normalP2.update(0.02);
assert.equal(context.normalGame.ringCalls.length, 1);
assert.equal(context.normalGame.aimedCalls.length, 1, '노멀 P2 링에도 고정 안전점 방지 조준탄을 섞는다');

context.hardGame = makeBossGame(2);
const hardP2 = vm.runInContext('new Boss(hardGame)', context);
hardP2.phase = 2;
hardP2.fireT = 0;
hardP2.update(0.02);
assert.equal(context.hardGame.ringCalls.length, 1);
assert.equal(context.hardGame.aimedCalls.length, 0, '이미 중심축이 닫히는 하드 패턴은 추가 압박을 덧대지 않는다');

const enemy = vm.runInContext(`new Enemy({
  kind: 'fish', hp: 10, spd: 0, x: 400, y: 200, dirX: 0, dirY: 0,
  M: 1, S: 0, fireDelay: 0,
  barragePatternId: 'pangpang-needle-fan',
  barragePattern: BarrageRuntime.get('pangpang-needle-fan'),
  barrageStopWhenLeaving: true,
})`, context);
const enemyGame = {
  player: { x: 100, y: 200 },
  diff: 0,
  ebullets: [],
};
enemy.update(1.51, enemyGame);
assert.equal(enemyGame.ebullets.length, 3, '일반 적도 연결된 탄막 공방 패턴을 실제 적탄 배열에 발사한다');
assert.ok(enemyGame.ebullets.every(bullet => bullet.patternId === 'pangpang-needle-fan'));

const turret = vm.runInContext(`new Enemy({
  kind: 'turret', hp: 7, spd: 0, x: 900, y: 420,
  M: 6, S: 0, fireDelay: 0,
})`, context);
const turretGame = { stageIdx: 0, scroll: 100, player: { x: 100, y: 270 }, ebullets: [] };
turret.update(1 / 60, turretGame);
const turretStartX = turret.x;
const layer = context.StageLayerTransform.layerConfig('stage1', 'near');
const startTravel = context.StageLayerTransform.layerTravelNative(turretGame.scroll, layer.speed, context.StageLayerTransform.PIXEL_UNIT, layer.scrollScale);
turretGame.scroll = 190;
turret.update(1 / 60, turretGame);
const endTravel = context.StageLayerTransform.layerTravelNative(turretGame.scroll, layer.speed, context.StageLayerTransform.PIXEL_UNIT, layer.scrollScale);
assert.equal(turretStartX - turret.x, (endTravel - startTravel) * context.StageLayerTransform.PIXEL_UNIT, '실제 포대는 near 지형과 같은 픽셀 오프셋으로 이동해야 한다');
assert.equal(turret.y, 420);

const turning = vm.runInContext(`new Enemy({
  kind: 'fish', hp: 2, spd: 160, x: 990, y: 270, dirX: -1, dirY: 0,
  M: 4, S: 0, movementParams: { turnX: 0.7, acceleration: 0.85, maxSpeedMultiplier: 1.15 },
})`, context);
let minimumTurnX = turning.x;
let sawTurnWarning = false;
for (let step = 0; step < 600; step++) {
  turning.update(1 / 120, enemyGame);
  minimumTurnX = Math.min(minimumTurnX, turning.x);
  sawTurnWarning ||= turning.uTurnPhase === 'brake';
  if (turning.uTurnPhase === 'exit') break;
}
assert.ok(Math.abs(minimumTurnX - 0.7 * vm.runInContext('CFG.W', context)) < 1.5, '실제 적도 저작한 X 위치에서 유턴해야 한다');
assert.equal(sawTurnWarning, true, '실제 적이 유턴 전 물보라 예고 상태를 거쳐야 한다');

const mainSource = fs.readFileSync(path.join(root, 'js/main.js'), 'utf8');
assert.match(mainSource, /BarrageRuntime\.updateProjectile\(b, dt/, '실제 게임은 공통 탄 이동·행동 실행기를 사용한다');
assert.match(mainSource, /BarrageRuntime\.laserHits\(b, pl/, '실제 게임은 레이저 선분 충돌을 사용한다');

console.log('barrage game integration: ok');
