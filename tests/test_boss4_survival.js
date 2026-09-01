'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
const source = fs.readFileSync(path.join(root, 'js/boss4.js'), 'utf8');
const context = vm.createContext({
  console,
  CFG: { W: 960, H: 540, boss4Hp: 700, bossMercyTime: 90, ebR: 5 },
  Sound: { sfx() {} },
  Pearl: function Pearl() {},
  Sprites: { draw: () => true },
  Fonts: { f: () => '10px sans-serif' },
  Math,
});
vm.runInContext(`${source}\nglobalThis.BossChorongForTest = BossChorong;`, context, { filename: 'js/boss4.js' });

function makeGame(diff) {
  return {
    diff,
    D: { bossInt: 1 },
    player: { x: 200, y: 270 },
    enemies: [], ebullets: [], pearls: [],
    spawner: { pending: [] },
    stageT: 115,
    clearBulletsToPearls() {}, message() {}, say() {}, addBattery() {}, phaseReward() {}, addFx() {},
  };
}

for (const [difficulty, viperCount] of [[0, 3], [1, 4], [2, 5]]) {
  const game = makeGame(difficulty);
  const boss = new context.BossChorongForTest(game);
  boss.phase = 2;
  boss.maxHp = 100;
  boss.hp = 34;
  boss.takeDamage(2);
  assert.equal(boss.phase, 2.5);
  assert.equal(boss.hittable, false);
  assert.equal(boss.survivalCount, viperCount);
  assert.equal(game.targetDark, 0.96);
  const lockedHp = boss.hp;
  boss.takeDamage(99);
  assert.equal(boss.hp, lockedHp, '소등 생존전 동안 보스는 피해를 받지 않아야 한다');

  boss.transitionT = 0;
  boss.update(0.71);
  assert.equal(boss.lurePower, 0.66);
  boss.update(0.71);
  assert.equal(boss.lurePower, 0.33);
  boss.update(0.71);
  assert.equal(boss.lurePower, 0, '세 번째 감광 단계 뒤에는 초롱 광원이 완전히 꺼져야 한다');
  for (let step = 0; step < 120 && boss.phase === 2.5; step++) boss.update(0.1);
  assert.equal(boss.phase, 3, '8초 생존전이 끝나면 P3가 시작되어야 한다');
  assert.equal(game.spawner.pending.length, viperCount);
  assert.ok(game.ebullets.length > 0, '생존전에는 느리고 성긴 별탄이 남아 있어야 한다');
  assert.equal(boss.hittable, true);
}

{
  const game = makeGame(1);
  const boss = new context.BossChorongForTest(game);
  boss.enterSurvival();
  const before = boss.survivalT;
  boss.onEnemyKilled({ chorongSurvival: true, x: 10, y: 20 });
  assert.ok(Math.abs(boss.survivalT - (before - 0.7)) < 1e-9);
  boss.onEnemyKilled({ kind: 'fish' });
  assert.ok(Math.abs(boss.survivalT - (before - 0.7)) < 1e-9,
    '생존전 독니고기가 아닌 적은 타이머를 줄이지 않아야 한다');
}

console.log('boss4 survival: ok');
