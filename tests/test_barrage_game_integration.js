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

for (const file of ['js/config.js', 'js/barragePatterns.generated.js', 'js/barrage.js', 'js/boss.js', 'js/entities.js']) {
  vm.runInContext(fs.readFileSync(path.join(root, file), 'utf8'), context, { filename: file });
}

context.game = {
  barragePatternId: null,
  D: { bossInt: 1 },
  diff: 0,
  player: { x: 100, y: 270 },
  dolphin: null,
  ebullets: [],
  pearls: [],
  spawner: { pending: [] },
  stageT: 0,
  message() {},
  clearBulletsToPearls() {},
  addBattery() {},
  phaseReward() {},
  victory() {},
  bossAimed() { throw new Error('데이터 패턴이 있는데 코드 폴백이 호출됨'); },
};

const boss = vm.runInContext('new Boss(game)', context);
boss.phase = 1;
boss.x = 780;
boss.y = 270;

boss.update(1.49);
assert.equal(context.game.ebullets.length, 0, '첫 발사는 1.5초 예고 뒤여야 한다');
boss.update(0.02);
assert.equal(context.game.ebullets.length, 3, '팡팡 P1은 JSON의 조준 3발을 실제 적탄 배열에 넣는다');
assert.ok(context.game.ebullets.every(bullet => bullet.vx < 0), '플레이어 쪽인 왼쪽으로 발사한다');

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

const mainSource = fs.readFileSync(path.join(root, 'js/main.js'), 'utf8');
assert.match(mainSource, /BarrageRuntime\.updateProjectile\(b, dt/, '실제 게임은 공통 탄 이동·행동 실행기를 사용한다');
assert.match(mainSource, /BarrageRuntime\.laserHits\(b, pl/, '실제 게임은 레이저 선분 충돌을 사용한다');

console.log('barrage game integration: ok');
