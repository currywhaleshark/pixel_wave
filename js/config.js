// ============================================================
// config.js — 튜닝 수치 (GDD 10장 "튜닝 수치" 대응)
// ============================================================
// ============================================================
// 난이도 — 데이터 복제 없이 곱셈 모디파이어 (이지 = 전부 ×1 → 기존 동작 보존)
// 보스 간격은 각 보스 mercy()에 bossInt가 곱해져 7마리 일괄 적용.
// 하드에선 체력 18% 이하에서 "진(眞) 대파도"(보스별 4페이즈)가 발동한다.
// ============================================================
const DIFFS = [
  // bossInt: 이지도 ×0.85 — 보스 기본 템포 상향 ("보스가 쉽다" 피드백 반영)
  { id: 'easy',   name: '이지', color: '#7dffd8',
    fireInt: 1,    ebSpd: 1,    ringN: 0, mineT: 1,    bossInt: 0.85, bossHp: 1,    bigHp: 1,   pearlMul: 1, scoreMul: 1.0 },
  { id: 'normal', name: '노멀', color: '#ffd76e',
    fireInt: 0.68, ebSpd: 1.1,  ringN: 2, mineT: 0.85, bossInt: 0.6,  bossHp: 1.25, bigHp: 1.3, pearlMul: 1.3, scoreMul: 1.5 },
  { id: 'hard',   name: '하드', color: '#ff8f8f',
    fireInt: 0.48, ebSpd: 1.22, ringN: 4, mineT: 0.7,  bossInt: 0.47, bossHp: 1.55, bigHp: 1.6, pearlMul: 1.6, scoreMul: 2.2 },
];
// 사격 패턴은 배율 외에 난이도별로 "진화"한다 (Enemy.shoot / onEnemyKilled 참조):
//  S1 조준 1발 → 2발 부채꼴 → 3발 / S2 링 → +조준 → +흩뿌리기 3발
//  S3 낙하 1발 → V자 2발 → 부채꼴 3발 흩뿌림 / S5 유언 1발 → 2발 → 5방향

const CFG = {
  W: 960, H: 540,        // 게임 로직 좌표계 (충돌·이동은 전부 이 공간)

  // ---- 픽셀 렌더 ----
  // 월드는 480×270으로 그린 뒤 정확히 2배 확대 → 픽셀아트 규격.
  // HUD·한글 텍스트는 960×540 레이어에 따로 그려 또렷하게 유지한다.
  WORLD_W: 480, WORLD_H: 270,
  pxUnit: 2,             // 월드 픽셀 1 = 게임 좌표 2 (W / WORLD_W)
  pixelMode: true,       // ?debug에서 6번 키로 토글 (아트 비교용)

  // 플레이어
  playerSpeed: 260,       // 최대속도 (전 입력 공통 — 밸런스의 핵심)
  playerSlowSpeed: 120,   // Shift 저속
  playerHitR: 6,          // 피격판정 (외형보다 훨씬 작게)
  playerDrawR: 16,
  touchOffsetY: -70,      // 터치: 손가락 위로 캐릭터 오프셋
  fireInterval: 0.14,     // 자동발사 간격 (통상샷이 만능이 되지 않게 — 역할은 돌고래에게)
  shotSpeed: 480,
  shotDmg: 1,

  // 파워 게이지 — 통화 가치와 분리 (진주가 파워를 너무 빨리 올리지 않게)
  gaugeNormal: 1,         // 일반 진주의 게이지 기여
  gaugeBig: 5,            // 큰 진주의 게이지 기여 (통화 10 대비 상대적으로 후함)
  gaugeLv2: 30,
  gaugeLv3: 50,

  // 피격/격침
  hitInvuln: 2.0,         // 피격 후 무적
  hitScatterPearls: 8,    // 피격 시 튕겨나가는 진주 (보유분에서 차감 — 복제 아님)
  scatterLife: 3.0,       // 튕긴 진주 회수 제한시간
  scatterNoCollect: 0.35, // 튕긴 직후 회수 불가 시간 (즉시 재획득 방지)
  bubbleTime: 3.0,        // 격침 → 기포 리스폰 시간
  respawnInvuln: 2.5,
  downPearlLossRate: 0.3, // 격침 시 그 판 진주 30% 증발

  // 배터리 (봄 = 소나 펄스)
  batteryStart: 2,
  batteryMax: 3,
  bombInvuln: 2.0,

  // 진주
  pearlMagnetR: 130,
  pearlMagnetSpeed: 280,   // 자석 기본 흡입 속도 (가까울수록 +320 보너스)
  pearlCollectR: 20,

  // 적탄 (물속이라 느리게)
  ebSpeedAimed: 145,
  ebSpeedRing: 110,
  ebSpeedDrop: 105,
  ebSpeedSpiral: 85,
  ebR: 5,

  // 스크롤 (배경/붙박이 포대)
  scrollSpeed: 45,

  // 보스
  // 보스 체력 (+~30% 상향 — 페이즈가 위협을 보여줄 시간 확보)
  bossHp: 500,
  boss2Hp: 600,
  boss3Hp: 660,
  boss4Hp: 720,
  boss5Hp: 800,
  boss6Hp: 900,
  boss7Hp: 1150,

  // 번개 (폭풍 수면)
  boltTelT: 0.9,          // 예고 시간
  boltStrikeT: 0.4,       // 낙뢰 지속
  boltW: 46,              // 기둥 폭
  bossMercyTime: 90,      // 초과 시 탄막 점감 (타임아웃 자비)

  // 기뢰 (S4 설치 등불)
  mineTimer: 2.2,         // 설치 후 폭발까지
  mineRingN: 6,           // 폭발 시 링 탄수
  mineRingSpd: 95,
};
