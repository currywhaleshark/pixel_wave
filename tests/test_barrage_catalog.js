'use strict';

const assert = require('node:assert/strict');
require('../js/barragePatterns.generated.js');
require('../js/barrage.js');

const catalog = globalThis.BARRAGE_PATTERN_DATA;
const baselineIds = [
  'bait-and-harpoon',
  'constellation-pulse',
  'crossing-rain',
  'curve-seeder',
  'laser-sweep',
  'mine-bloom-garden',
  'needle-pendulum',
  'pangpang-needle-fan',
  'stop-and-turn',
  'twin-current-spiral',
  'wandering-gates',
];
assert.ok(Object.keys(catalog).length >= baselineIds.length, '기본 탄막 프리셋 11종 이상이 번들되어야 한다');
for (const id of baselineIds) assert.ok(catalog[id], `기본 탄막 '${id}'이 번들에 있어야 한다`);

for (const [id, raw] of Object.entries(catalog)) {
  assert.equal(raw.id, id, `${id}: 레지스트리 키와 패턴 id가 같아야 한다`);
  assert.deepEqual(BarrageRuntime.validate(raw), [], `${id}: 패턴 검증을 통과해야 한다`);
  const compiled = BarrageRuntime.compile(raw);
  assert.ok(compiled.events.length > 0, `${id}: 발사 이벤트가 있어야 한다`);
  assert.ok(compiled.events.length < 10000, `${id}: 이벤트 안전 한도를 넘지 않아야 한다`);

  const bullets = [];
  const runner = new BarrageRuntime.Runner(raw, { emit: bullet => bullets.push(bullet) });
  runner.update(raw.duration, {
    source: { x: 780, y: 270 },
    target: { x: 170, y: 270 },
    difficulty: 0,
  });
  assert.ok(bullets.length > 0, `${id}: 실제 탄을 생성해야 한다`);
}

console.log('barrage catalog: ok');
