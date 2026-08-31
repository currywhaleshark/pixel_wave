'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const EnemyState = require('../js/stage/enemyState.js');
const StageCompiler = require('../js/stage/compiler.js');

{
  const unlit = EnemyState.resolve('viper', 0.4, { revealDelay: 0.8, glintDuration: 0.55 }, { trackingDuration: 3 });
  assert.equal(unlit.phase, 'unlit');
  assert.equal(unlit.targetable, false);
  assert.equal(unlit.hittable, false);
  assert.equal(unlit.collidable, false);
  assert.equal(unlit.canFire, false);
  assert.equal(unlit.glow, 0);

  const glint = EnemyState.resolve('viper', 1, { revealDelay: 0.8, glintDuration: 0.55 }, { trackingDuration: 3 });
  assert.equal(glint.phase, 'glint');
  assert.equal(glint.tracking, false);

  const hunt = EnemyState.resolve('viper', 1.5, { revealDelay: 0.8, glintDuration: 0.55 }, { trackingDuration: 3 });
  assert.equal(hunt.phase, 'hunt');
  assert.equal(hunt.targetable, true);
  assert.equal(hunt.tracking, true);

  const leave = EnemyState.resolve('viper', 4.5, { revealDelay: 0.8, glintDuration: 0.55 }, { trackingDuration: 3 });
  assert.equal(leave.phase, 'leave');
  assert.equal(leave.tracking, false);
  assert.equal(leave.collidable, true);
}

{
  const params = { warningDuration: 0.8, outlineDuration: 0.2, solidDuration: 1.6 };
  assert.equal(EnemyState.resolve('ghost', 0.4, params).phase, 'warning');
  assert.equal(EnemyState.resolve('ghost', 0.9, params).phase, 'outline');
  assert.equal(EnemyState.resolve('ghost', 1.2, params).phase, 'solid');
  assert.equal(EnemyState.resolve('ghost', 2.7, params).phase, 'warning');
  assert.equal(EnemyState.resolve('ghost', 0.4, { ...params, phaseOffset: 0.8 }).phase, 'solid');
  assert.deepEqual(EnemyState.validate('ghost', { solidDuration: 0 }), ['solidDuration 값이 0.05~30 범위를 벗어났습니다.']);
}

{
  const source = JSON.parse(read('docs/stage-editor/stage4.v1.draft.json'));
  const wave = source.items.find(item => item.type === 'wave' && item.payload.enemy.kind === 'viper');
  wave.payload.enemy.params = { revealDelay: 1.2, glintDuration: 0.4, extensionValue: 7 };
  wave.payload.movement.params = { trackingDuration: 4.5, turnRate: 0.65 };
  const event = StageCompiler.compile(source, { difficulty: 'easy' }).events.find(item => item.itemId === wave.id);
  assert.equal(event.enemy.params.revealDelay, 1.2);
  assert.equal(event.enemy.params.glintDuration, 0.4);
  assert.equal(event.enemy.params.extensionValue, 7);
  assert.equal(event.enemy.movement.params.trackingDuration, 4.5);
  assert.equal(event.enemy.movement.params.turnRate, 0.65);
}

{
  const context = vm.createContext({
    console,
    Math,
    Sound: { sfx() {} },
    Assets: { has() { return false; } },
    Sprites: { has() { return false; }, draw() { return false; } },
    SPRITES: {},
  });
  for (const file of ['js/config.js', 'js/stage/enemyState.js', 'js/entities.js']) {
    vm.runInContext(read(file), context, { filename: file });
  }
  vm.runInContext('globalThis.EnemyForTest = Enemy;', context);
  const Enemy = context.EnemyForTest;
  const game = { player: { x: 100, y: 270 }, ebullets: [], diff: 0 };
  const viper = new Enemy({
    kind: 'viper', hp: 3, spd: 100, x: 700, y: 270, dirX: -1, dirY: 0,
    M: 5, S: 0, params: { revealDelay: 0.8, glintDuration: 0.55 },
    movementParams: { trackingDuration: 3, turnRate: 0.5 },
  });
  assert.equal(viper.isTargetable(), false);
  viper.takeDamage(1, game);
  assert.equal(viper.hp, 3, '잠복 중인 독니고기는 피해를 받지 않는다');
  viper.update(1.5, game);
  assert.equal(viper.lifecycle.phase, 'hunt');
  assert.equal(viper.isTargetable(), true);
  viper.takeDamage(1, game);
  assert.equal(viper.hp, 2);

  const ghost = new Enemy({ kind: 'ghost', hp: 2, spd: 0, x: 400, y: 200, dirX: -1, dirY: 0, M: 1, S: 0 });
  assert.equal(ghost.lifecycle.phase, 'warning');
  assert.equal(ghost.isCollidable(), false);
  ghost.update(1.1, game);
  assert.equal(ghost.lifecycle.phase, 'solid');
  assert.equal(ghost.isCollidable(), true);
}

console.log('enemy state: ok');
