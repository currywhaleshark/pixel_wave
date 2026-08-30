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
    movementPresets: Object.freeze([
      Object.freeze({ id: 'straight', name: '직선', description: '진입 방향과 속도를 유지해 곧게 이동', fields: Object.freeze([]) }),
      Object.freeze({
        id: 'sine', name: '물결', description: '진행 방향의 옆축으로 부드럽게 물결치며 이동',
        fields: Object.freeze([
          Object.freeze({ key: 'amplitude', target: 'params', label: '물결 폭', min: 0, max: 300, step: 1, default: 0 }),
          Object.freeze({ key: 'frequency', target: 'params', label: '물결 속도', min: 0, max: 20, step: 0.1, default: 3 }),
        ]),
      }),
      Object.freeze({
        id: 'enter-pause-exit', name: '진입 · 정지 · 퇴장', description: '화면 안 목표점에서 잠시 멈춰 공격한 뒤 빠르게 퇴장',
        fields: Object.freeze([
          Object.freeze({ key: 'targetX', target: 'params', label: '정지 X 위치', min: 0, max: 1, step: 0.01, default: 0.68, defaults: Object.freeze({ 'left-to-right': 0.32 }), entryAxis: 'x' }),
          Object.freeze({ key: 'targetY', target: 'params', label: '정지 Y 위치', min: 0, max: 1, step: 0.01, default: 0.3, defaults: Object.freeze({ 'bottom-to-top': 0.7, 'diagonal-up': 0.7 }), entryAxis: 'y' }),
          Object.freeze({ key: 'pauseDuration', target: 'params', label: '정지 시간', min: 0, max: 60, step: 0.1, default: 2.2 }),
          Object.freeze({ key: 'exitMultiplier', target: 'params', label: '퇴장 속도 배율', min: 0.1, max: 10, step: 0.05, default: 1.7 }),
        ]),
      }),
      Object.freeze({
        id: 'u-turn', name: '유턴', description: '반대 방향으로 진입한 뒤 가속해 되돌아가는 곡선 이동',
        fields: Object.freeze([
          Object.freeze({ key: 'acceleration', target: 'params', label: '유턴 가속', min: 0, max: 5, step: 0.05, default: 0.85 }),
          Object.freeze({ key: 'maxSpeedMultiplier', target: 'params', label: '최대 속도 배율', min: 0.1, max: 5, step: 0.05, default: 1.15 }),
          Object.freeze({ key: 'verticalAmplitude', target: 'params', label: '곡선 높이', min: 0, max: 300, step: 1, default: 18 }),
          Object.freeze({ key: 'verticalFrequency', target: 'params', label: '곡선 속도', min: 0, max: 20, step: 0.1, default: 1.8 }),
        ]),
      }),
      Object.freeze({ id: 'custom-path', name: '직접 경로', description: '미리보기 위의 번호 점을 직접 움직여 경로를 작성', fields: Object.freeze([]) }),
    ]),
    weaponPresets: Object.freeze([
      Object.freeze({ id: 'none', name: '사격 없음', description: '이 웨이브에서는 탄을 발사하지 않음', fields: Object.freeze([]) }),
      Object.freeze({
        id: 'legacy-aimed', name: '조준탄', description: '플레이어를 향해 발사하며 난이도에 따라 탄 수와 속도가 증가',
        fields: Object.freeze([
          Object.freeze({ key: 'interval', target: 'root', label: '발사 간격', min: 0.03, max: 120, step: 0.01, default: 2 }),
          Object.freeze({ key: 'startDelay', target: 'root', label: '첫 발 지연', min: 0, max: 120, step: 0.05, default: 0.6 }),
        ]),
      }),
      Object.freeze({
        id: 'legacy-ring', name: '원형탄', description: '원형 탄막을 발사하며 난이도 보정 전에 쓸 기본 탄 수를 지정',
        fields: Object.freeze([
          Object.freeze({ key: 'interval', target: 'root', label: '발사 간격', min: 0.03, max: 120, step: 0.01, default: 2 }),
          Object.freeze({ key: 'startDelay', target: 'root', label: '첫 발 지연', min: 0, max: 120, step: 0.05, default: 0.6 }),
          Object.freeze({ key: 'count', target: 'params', label: '기본 탄 수', min: 1, max: 256, step: 1, default: 8, integer: true }),
        ]),
      }),
      Object.freeze({
        id: 'legacy-death-shot', name: '유언탄', description: '적이 격파될 때 난이도별 탄을 발사. 무피격 시퀀서 미리보기에서는 발생하지 않음',
        fields: Object.freeze([]),
      }),
    ]),
  });

  const categories = Object.freeze({
    enemyKinds: new Set(definitions.enemyKinds.map(item => item.id)),
    entryPresets: new Set(definitions.entryPresets.map(item => item.id)),
    formationPresets: new Set(['single', 'column', 'v', 'wall-gap']),
    movementPresets: new Set(definitions.movementPresets.map(item => item.id)),
    weaponPresets: new Set(definitions.weaponPresets.map(item => item.id)),
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
    if (category === 'barragePatterns') return /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(String(id || ''));
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
