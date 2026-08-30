// ============================================================
// stage/registry.js — Stage JSON v1의 M1 읽기 전용 레지스트리
// UI와 컴파일러가 같은 ID·난이도 정의를 참조한다.
// ============================================================
(function initStageRegistry(root) {
  'use strict';

  const DIFFICULTIES = Object.freeze([
    Object.freeze({ id: 'easy', name: '이지', color: '#7dffd8', fireInt: 1, ebSpd: 1, ringN: 0, bigHp: 1 }),
    Object.freeze({ id: 'normal', name: '노멀', color: '#ffd76e', fireInt: 0.68, ebSpd: 1.1, ringN: 2, bigHp: 1.3 }),
    Object.freeze({ id: 'hard', name: '하드', color: '#ff8f8f', fireInt: 0.48, ebSpd: 1.22, ringN: 4, bigHp: 1.6 }),
  ]);

  const categories = Object.freeze({
    enemyKinds: new Set(['fish', 'ray', 'big']),
    entryPresets: new Set(['right-to-left', 'left-to-right']),
    formationPresets: new Set(['single', 'column', 'v', 'wall-gap']),
    movementPresets: new Set(['straight', 'sine', 'enter-pause-exit', 'u-turn']),
    weaponPresets: new Set(['none', 'legacy-aimed', 'legacy-ring', 'legacy-death-shot']),
    barragePatterns: new Set(),
    itemPlugins: new Set(['scroll-speed', 'turtle-ride', 'boss-warning', 'boss-start']),
    terrainObjects: new Set(),
    terrainProfiles: new Set(),
    bosses: new Set(['ssing']),
  });

  const itemPriority = Object.freeze({
    environment: 0,
    gimmick: 1,
    hazard: 2,
    wave: 3,
    'terrain-object': 4,
    cue: 5,
    boss: 6,
  });

  function difficulty(value) {
    if (typeof value === 'string') {
      return DIFFICULTIES.find(item => item.id === value) || DIFFICULTIES[0];
    }
    return DIFFICULTIES[Math.max(0, Math.min(DIFFICULTIES.length - 1, Number(value) || 0))];
  }

  function knows(category, id) {
    return !!categories[category]?.has(id);
  }

  const api = Object.freeze({ DIFFICULTIES, categories, itemPriority, difficulty, knows });
  root.StageRegistry = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : window);
