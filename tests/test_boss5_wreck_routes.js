'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
const source = fs.readFileSync(path.join(root, 'js/boss5.js'), 'utf8');
const context = vm.createContext({
  console,
  CFG: { W: 960, H: 540, boss5Hp: 720, bossMercyTime: 90, ebR: 5, playerHitR: 3 },
  Sound: { sfx() {} },
  Pearl: function Pearl() {},
  Enemy: function Enemy(spec) { Object.assign(this, spec); },
  StageWreck: {
    createSpawnSpec(params, viewport, meta) {
      return { kind: 'wreck', wreckSide: params.side, wreckVariant: params.variant, wreckW: params.width, viewport, ...meta };
    },
  },
  Sprites: { draw: () => true },
  Fonts: { f: () => '10px sans-serif' },
  Math,
});
vm.runInContext(`${source}\nglobalThis.BossBuuForTest = BossBuu;`, context, { filename: 'js/boss5.js' });

function makeGame(diff) {
  return {
    diff,
    D: { bossInt: 1 },
    player: { x: 180, y: 270, hit() {} },
    enemies: [], ebullets: [], pearls: [], fx: [],
    spawner: { pending: [] }, stageT: 115,
    clearBulletsToPearls() {}, message() {}, say() {}, addBattery() {}, phaseReward() {},
  };
}

for (const [difficulty, ghostCount] of [[0, 2], [2, 3]]) {
  const game = makeGame(difficulty);
  const boss = new context.BossBuuForTest(game);
  boss.holeIdx = 0;
  boss.spawnWreckGhostRoute();
  assert.equal(game.enemies[0].kind, 'wreck');
  assert.equal(game.enemies[0].wreckSide, 'top');
  assert.equal(game.enemies[0].wreckVariant, 'bow');
  assert.equal(game.enemies[0].wreckW, 92);
  assert.equal(game.spawner.pending.length, ghostCount);
  assert.ok(game.spawner.pending.every(entry => entry.spec.params.warningDuration === 0.8));
  assert.ok(game.spawner.pending[1].spec.params.phaseOffset > game.spawner.pending[0].spec.params.phaseOffset);
}

{
  const game = makeGame(1);
  const boss = new context.BossBuuForTest(game);
  boss.phase = 3;
  boss.transitionT = 0;
  boss.routeCycleT = 0;
  boss.x = 800;
  boss.y = 270;
  boss.update(0.1);
  assert.equal(boss.routeModeT, 6);
  assert.equal(game.enemies.length, 1, 'P3 몸통 횡단 사이에 난파선 통로가 시작되어야 한다');
  const x = boss.x;
  boss.update(0.1);
  assert.ok(boss.x !== x, '통로 패턴 중 부우는 반대쪽 안전 경로로 이동해야 한다');
  assert.equal(boss.trail.length, 0, '통로 패턴과 장신 몸통 횡단은 동시에 활성화되지 않아야 한다');
}

console.log('boss5 wreck routes: ok');
