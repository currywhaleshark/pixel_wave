const assert = require('assert');
const Placement = require('../js/stage/previewPlacement.js');

function wave(overrides = {}) {
  return {
    id: 'wave-1',
    type: 'wave',
    timing: { domain: 'time', start: 10, duration: 1 },
    payload: {
      entry: { presetId: 'right-to-left', x: 0.5, y: 0.4 },
      movement: { presetId: 'straight' },
      ...overrides,
    },
  };
}

{
  const result = Placement.applyDrag(wave(), {
    deltaX: 150,
    deltaY: 54,
    velocityX: -150,
    velocityY: 0,
    viewport: { width: 960, height: 540 },
    timelineDuration: 120,
  });
  assert.equal(result.item.timing.start, 11, '왼쪽 이동 적을 오른쪽으로 끌면 더 늦게 등장해야 한다');
  assert.equal(result.item.payload.entry.y, 0.5, '세로 이동은 진입 높이에 반영되어야 한다');
  assert.equal(result.coordinate, 'y');
}

{
  const result = Placement.applyDrag(wave({
    entry: { presetId: 'top-to-bottom', x: 0.25, y: 0.5 },
  }), {
    deltaX: 96,
    deltaY: 120,
    velocityX: -30,
    velocityY: 120,
    viewport: { width: 960, height: 540 },
    timelineDuration: 120,
  });
  assert.equal(result.item.timing.start, 9, '아래로 끌면 더 일찍 등장해야 한다');
  assert.equal(result.item.payload.entry.x, 0.35, '가로 이동은 위쪽 진입 X에 반영되어야 한다');
}

{
  const result = Placement.applyDrag(wave({
    movement: {
      presetId: 'custom-path',
      path: [
        { t: 0, x: 1, y: 0.2 },
        { t: 2, x: 0.5, y: 0.4 },
      ],
    },
  }), {
    deltaX: 100,
    deltaY: 54,
    velocityX: -100,
    viewport: { width: 960, height: 540 },
    timelineDuration: 120,
  });
  assert.equal(result.item.timing.start, 11);
  assert.deepEqual(result.item.payload.movement.path.map(point => point.y), [0.3, 0.5], '사용자 경로는 교차축 전체를 함께 옮겨야 한다');
}

{
  const result = Placement.applyDrag(wave(), {
    deltaX: -9999,
    deltaY: -9999,
    velocityX: -150,
    viewport: { width: 960, height: 540 },
    timelineDuration: 12,
  });
  assert.equal(result.item.timing.start, 0, '등장 시각은 타임라인 밖으로 나가면 안 된다');
  assert.equal(result.item.payload.entry.y, 0, '진입 좌표는 화면 비율 범위에 고정되어야 한다');
}

{
  const result = Placement.applyDrag(wave(), {
    deltaX: 9999,
    velocityX: -150,
    viewport: { width: 960, height: 540 },
    timelineDuration: 120,
    latestVisibleStart: 12,
  });
  assert.equal(result.item.timing.start, 12, '현재 보이는 적의 등장 시각은 미리보기 시각 뒤로 넘어가면 안 된다');
}

console.log('stage preview placement: ok');
