'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
const source = fs.readFileSync(path.join(root, 'js/boss3.js'), 'utf8');
const context = vm.createContext({
  console,
  CFG: { W: 960, H: 540, boss3Hp: 660, bossMercyTime: 90, ebR: 5 },
  Sound: { sfx() {} },
  Pearl: function Pearl() {},
  Sprites: { draw: () => true },
  Fonts: { f: () => '10px sans-serif' },
  Math,
});
vm.runInContext(`${source}\nglobalThis.BossSsingForTest = BossSsing;`, context, { filename: 'js/boss3.js' });

function makeGame(diff) {
  return {
    diff,
    D: { bossInt: 1 },
    player: { x: 200, y: 270 },
    ebullets: [], pearls: [],
    spawner: { pending: [] },
    stageT: 130,
    clearBulletsToPearls() {},
    message() {}, addBattery() {}, phaseReward() {},
    startRide(duration, params) {
      this.rideStart = { duration, params };
      this.ride = { params, durability: params.taxiDurability };
    },
    finishRide(reason) { this.rideEnd = reason; this.ride = null; },
  };
}

for (const [difficulty, durability] of [[0, 3], [1, 2], [2, 2]]) {
  const game = makeGame(difficulty);
  const boss = new context.BossSsingForTest(game);
  boss.phase = 2;
  boss.maxHp = 100;
  boss.hp = 34;
  boss.takeDamage(2);
  assert.equal(boss.phase, 2.5);
  assert.equal(game.rideStart.duration, 9);
  assert.equal(game.rideStart.params.playerInvulnerable, false);
  assert.equal(game.rideStart.params.taxiDurability, durability);
  assert.equal(game.rideStart.params.continueIntoBoss, true);
  assert.equal(game.rideStart.params.pearlTrail.enabled, false);

  boss.transitionT = 0;
  for (let step = 0; step < 100 && boss.phase === 2.5; step++) boss.update(0.1);
  assert.equal(boss.phase, 3, '9초 추격이 끝나면 P3가 시작되어야 한다');
  assert.ok(game.ebullets.length > 0, '추격 중 안전 차선이 있는 교통 벽이 생성되어야 한다');
  assert.ok(game.spawner.pending.length > 0, '추격 중 가오리 호위가 생성되어야 한다');
  assert.equal(game.rideEnd, 'complete');
}

console.log('boss3 chase: ok');
