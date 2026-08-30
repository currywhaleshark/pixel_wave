// ============================================================
// stage/registry.js — Stage JSON v1 프리셋 ID와 편집기 메타데이터
// UI와 컴파일러가 같은 ID·난이도 정의를 참조한다.
// ============================================================
(function initStageRegistry(root) {
  'use strict';

  const DIFFICULTIES = Object.freeze([
    Object.freeze({ id: 'easy', name: '이지', color: '#7dffd8', fireInt: 1, ebSpd: 1, ringN: 0, bigHp: 1 }),
    Object.freeze({ id: 'normal', name: '노멀', color: '#ffd76e', fireInt: 0.68, ebSpd: 1.1, ringN: 2, bigHp: 1.3 }),
    Object.freeze({ id: 'hard', name: '하드', color: '#ff8f8f', fireInt: 0.48, ebSpd: 1.22, ringN: 4, bigHp: 1.6 }),
  ]);

  const definitions = Object.freeze({
    enemyKinds: Object.freeze([
      Object.freeze({ id: 'fish', name: '물고기', description: '빠른 기본 잡몹', defaults: Object.freeze({ hp: 2, speed: 150 }) }),
      Object.freeze({ id: 'jelly', name: '해파리', description: '상하 진입에 어울리는 느린 잡몹', defaults: Object.freeze({ hp: 2, speed: 70 }) }),
      Object.freeze({ id: 'ray', name: '가오리', description: '멈춰 사격하는 중형 적', defaults: Object.freeze({ hp: 4, speed: 150 }) }),
      Object.freeze({ id: 'turret', name: '산호 포대', description: '지형 가까이에 배치하는 고정 포대', defaults: Object.freeze({ hp: 7, speed: 0 }) }),
      Object.freeze({ id: 'lantern', name: '등불해파리', description: '어둠을 밝히는 이동 광원', defaults: Object.freeze({ hp: 5, speed: 55 }) }),
      Object.freeze({ id: 'viper', name: '부우', description: '길게 휘며 돌진하는 곰치', defaults: Object.freeze({ hp: 3, speed: 120 }) }),
      Object.freeze({ id: 'ghost', name: '유령 물고기', description: '나타났다 사라지는 난파선 적', defaults: Object.freeze({ hp: 2, speed: 115 }) }),
      Object.freeze({ id: 'big', name: '대물', description: '높은 체력과 탄막을 가진 대형 적', defaults: Object.freeze({ hp: 48, speed: 105 }) }),
    ]),
    entryPresets: Object.freeze([
      Object.freeze({ id: 'right-to-left', name: '오른쪽 → 왼쪽', description: '화면 오른쪽에서 진입', coordinate: 'y' }),
      Object.freeze({ id: 'left-to-right', name: '왼쪽 → 오른쪽', description: '플레이어 뒤에서 추월', coordinate: 'y' }),
      Object.freeze({ id: 'top-to-bottom', name: '위 → 아래', description: '화면 위에서 내려옴', coordinate: 'x' }),
      Object.freeze({ id: 'bottom-to-top', name: '아래 → 위', description: '화면 아래에서 떠오름', coordinate: 'x' }),
      Object.freeze({ id: 'diagonal', name: '대각선', description: '위나 아래에서 비스듬히 진입', coordinate: 'x' }),
    ]),
  });

  const categories = Object.freeze({
    enemyKinds: new Set(definitions.enemyKinds.map(item => item.id)),
    entryPresets: new Set(definitions.entryPresets.map(item => item.id)),
    formationPresets: new Set(['single', 'column', 'v', 'wall-gap']),
    movementPresets: new Set(['straight', 'sine', 'enter-pause-exit', 'u-turn', 'custom-path']),
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

  function entries(category) {
    if (definitions[category]) return definitions[category].slice();
    return Array.from(categories[category] || [], id => Object.freeze({ id, name: id, description: '' }));
  }

  function get(category, id) {
    return entries(category).find(item => item.id === id) || null;
  }

  const api = Object.freeze({ DIFFICULTIES, categories, definitions, itemPriority, difficulty, knows, entries, get });
  root.StageRegistry = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : window);
