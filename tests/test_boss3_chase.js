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
    entryWarnings: [],
    stageT: 130,
    clearBulletsToPearls() {},
    message() {}, addBattery() {}, phaseReward() {},
    addStageEntryWarning(warning) { this.entryWarnings.push(warning); },
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
  assert.equal(game.rideStart.duration, 10);
  assert.equal(game.rideStart.params.scrollMultiplier, 4.2);
  assert.equal(game.rideStart.params.playerInvulnerable, false);
  assert.equal(game.rideStart.params.taxiDurability, durability);
  assert.equal(game.rideStart.params.continueIntoBoss, true);
  assert.equal(game.rideStart.params.pearlTrail.enabled, false);

  boss.transitionT = 0;
  for (let step = 0; step < 110 && boss.phase === 2.5; step++) boss.update(0.1);
  assert.equal(boss.phase, 3, '10초 고속 추격이 끝나면 P3가 시작되어야 한다');
  assert.ok(game.ebullets.length > 0, '추격 중 안전 차선이 있는 교통 벽이 생성되어야 한다');
  const traffic = game.spawner.pending.map(item => item.spec);
  assert.ok(traffic.some(spec => spec.kind === 'ray'), '추격 중 가오리 호위가 생성되어야 한다');
  assert.ok(traffic.some(spec => spec.kind === 'fish' && spec.dirX < 0), '앞에서 오는 고속 잡몹 교통이 보여야 한다');
  assert.ok(traffic.some(spec => spec.kind === 'fish' && spec.dirX > 0), '뒤에서 추월하는 고속 잡몹 교통도 보여야 한다');
  assert.ok(traffic.filter(spec => spec.kind === 'fish').every(spec => spec.S === 0 && spec.spd >= 360));
  assert.ok(game.entryWarnings.some(warning => warning.side === 'left' && warning.duration >= 0.55), '후방 추월 잡몹은 진입 전에 경고해야 한다');
  assert.equal(game.rideEnd, 'complete');
}

{
  const game = makeGame(0);
  const boss = new context.BossSsingForTest(game);
  boss.phase = 2;
  boss.transitionT = 0;
  boss.carT = 999;
  boss.summonT = 999;
  const laneYs = [];
  for (let volley = 0; volley < 6; volley++) {
    boss.laneT = 0;
    const before = game.ebullets.length;
    boss.update(0.01);
    laneYs.push(game.ebullets.slice(before).find(bullet => bullet.kind === 'spike').y);
  }
  assert.ok(new Set(laneYs.map(value => Math.round(value))).size >= 5, 'P2 차선 중심이 발사 묶음마다 이동해야 한다');
  assert.ok(laneYs.some(value => ![0.15, 0.32, 0.5, 0.68, 0.85].some(lane => Math.abs(value - lane * 540) < 0.1)));

  boss.laneT = 999;
  boss.carT = 0;
  boss.update(0.01);
  assert.ok(game.ebullets.some(bullet => bullet.kind === 'car'), '이지에서도 차선 사이 고정 캠핑을 훑어야 한다');
}

console.log('boss3 chase: ok');
