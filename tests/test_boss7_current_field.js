'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const CurrentField = require('../js/stage/currentField.js');
const root = path.resolve(__dirname, '..');
const source = fs.readFileSync(path.join(root, 'js/boss7.js'), 'utf8');
const context = vm.createContext({
  console,
  CFG: {
    W: 960, H: 540, boss7Hp: 900, bossMercyTime: 90,
    ebR: 5, boltW: 46, boltTelT: 0.9, boltStrikeT: 0.4,
  },
  Sound: { sfx() {} },
  Pearl: function Pearl() {},
  Sprites: { draw: () => true, has: () => false },
  Fonts: { f: () => '10px sans-serif' },
  Math,
});
vm.runInContext(`${source}\nglobalThis.BossHwiiForTest = BossHwii;`, context, { filename: 'js/boss7.js' });

function makeGame(diff = 1) {
  return {
    diff,
    D: { bossInt: 1 },
    player: { x: 180, y: 270 },
    bolts: [], ebullets: [], pearls: [],
    stormScale: 1, bossCurrentOverride: null, bossCurrentField: null,
    clearBulletsToPearls() {}, message() {}, say() {}, addBattery() {}, phaseReward() {},
    bossRing() {}, startEnding() {}, victory() {},
  };
}

{
  const field = { center: { x: 0, y: 0 }, radialStrength: -60, tangentialStrength: 20 };
  assert.deepEqual(CurrentField.sample(field, { x: 100, y: 0 }), { x: -60, y: 20 });
  assert.deepEqual(CurrentField.sample(field, { x: 0, y: 100 }), { x: -20, y: -60 });
  const inner = CurrentField.sample({
    center: { x: 0, y: 0 }, radialStrength: 40, innerRadius: 320,
    innerRadialStrength: 88, tangentialStrength: 54,
  }, { x: 100, y: 0 });
  assert.deepEqual(inner, { x: 88, y: 54 });
}

{
  const game = makeGame();
  const boss = new context.BossHwiiForTest(game);
  boss.phase = 1;
  boss.transitionT = 0;
  boss.x = 680;
  boss.y = 270;
  boss.update(0.1);
  assert.equal(game.bossCurrentField.radialStrength, -58);
  assert.equal(game.bossCurrentField.tangentialStrength, 18);

  boss.enterPhase(2);
  assert.equal(game.bossCurrentField, null, '페이즈 전환 중 이전 흡입장이 남지 않아야 한다');
  boss.transitionT = 0;
  boss.update(0.1);
  assert.ok(Math.abs(game.bossCurrentOverride.x) === 110);

  boss.enterPhase(3);
  boss.transitionT = 0;
  boss.update(0.1);
  assert.equal(game.bossCurrentField.innerRadialStrength, 88);
  assert.equal(game.bossCurrentField.tangentialStrength, 54);

  boss.phase = 4;
  boss.transitionT = 0;
  boss.update(0.1);
  assert.equal(game.bossCurrentField.tangentialStrength, 68);
  boss.die();
  assert.equal(game.bossCurrentField, null);
  assert.equal(game.bossCurrentOverride, null);
}

console.log('boss7 current field: ok');
