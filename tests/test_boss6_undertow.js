'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
const source = fs.readFileSync(path.join(root, 'js/boss6.js'), 'utf8');
const context = vm.createContext({
  console,
  CFG: {
    W: 960, H: 540, boss6Hp: 760, bossMercyTime: 90,
    ebR: 5, boltW: 46, boltTelT: 0.9, boltStrikeT: 0.4, playerHitR: 3,
  },
  Sound: { sfx() {} },
  Pearl: function Pearl() {},
  Sprites: { draw: () => true },
  Fonts: { f: () => '10px sans-serif' },
  Math,
});
vm.runInContext(`${source}\nglobalThis.BossUreuForTest = BossUreu;`, context, { filename: 'js/boss6.js' });

function makeGame(diff) {
  return {
    diff,
    D: { bossInt: 1 },
    player: { x: 180, y: 270, bubble: 0, hit() {} },
    bolts: [], ebullets: [], pearls: [], fx: [],
    flashT: 0, shake: 0, stormScale: 2, bossCurrentOverride: null,
    clearBulletsToPearls() {}, message() {}, say() {}, addBattery() {}, phaseReward() {},
    bossAimed() {}, bossRing() {}, victory() {},
  };
}

{
  const game = makeGame(1);
  const boss = new context.BossUreuForTest(game);
  boss.phase = 3;
  boss.transitionT = 0;
  boss.update(0.71);
  assert.equal(boss.undertowMode, 'pull');
  boss.update(0.1);
  assert.equal(game.bossCurrentOverride.x, 80, '보통 난이도 직선 해류는 80px/s로 민다');
  boss.update(1.11);
  assert.equal(boss.undertowMode, 'recovery');
  assert.equal(game.bossCurrentOverride, null, '낙뢰 스윕 뒤 회복 구간에는 강제 해류를 끈다');
  assert.deepEqual(game.bolts.map(bolt => bolt.x), [768, 576, 384, 192]);
  assert.deepEqual(game.bolts.map(bolt => bolt.telT), [0.9, 1.12, 1.34, 1.56]);
  boss.update(1.01);
  assert.equal(boss.undertowMode, 'telegraph');
  assert.equal(boss.undertowDir, -1, '다음 직선 해류는 반대 방향이어야 한다');
}

{
  const game = makeGame(2);
  const boss = new context.BossUreuForTest(game);
  boss.phase = 3;
  boss.transitionT = 0;
  boss.undertowMode = 'pull';
  boss.undertowT = 1;
  boss.update(0.1);
  assert.equal(game.bossCurrentOverride.x, 90, '하드 난이도는 직선 해류가 더 강해야 한다');
  boss.die();
  assert.equal(game.bossCurrentOverride, null, '보스 격파 뒤 강제 해류가 남지 않아야 한다');
}

console.log('boss6 undertow: ok');
