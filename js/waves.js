// ============================================================
// waves.js — 잡몹 문법(5축) 스포너 + 스테이지 타임라인 (GDD 8장)
// 웨이브 = 데이터. 밸런스 조정 = 이 파일 편집.
//
// 리듬 원칙 (루즈함 방지):
//  - 웨이브 간격 2.5~4초 — 처치 속도에 맞춰 빈 화면 최소화
//  - 대부분의 웨이브에 0.5~1.5초 시차로 부속 웨이브를 겹침
//    (사격 레인 + 진주 셔틀 레인이 동시에 흐르는 그림이 기본)
//  - 쉼표(단독 셔틀)는 막 전환부에만 의도적으로 배치
//
// 대물(big): 크고 튼튼한 미니보스급, S2 링 살포(ringN). 격파 시 큰 진주 확정.
// ============================================================

// 스테이지 1 "산호 초입": M2·S0 편중(평화), 후반 갈수록 S1·S3 증가.
// 3막: 도입(0~32) → 압박(34~70) → 혼합+파밍(73~108) → 보스 114
const STAGE1_TIMELINE = [
  // ===== 1막: 도입 =====
  { t: 2,    kind: 'fish', M: 2, D: 1, F: 2, S: 0, n: 6, gap: 0.32, y: 0.35, amp: 30, freq: 3, spd: 120, hp: 2 },
  { t: 4.5,  kind: 'fish', M: 2, D: 1, F: 2, S: 0, n: 6, gap: 0.32, y: 0.65, amp: 30, freq: 3, spd: 120, hp: 2 },
  { t: 8,    kind: 'fish', M: 2, D: 1, F: 2, S: 0, n: 7, gap: 0.28, y: 0.5,  amp: 60, freq: 2.5, spd: 130, hp: 2 },
  { t: 11,   kind: 'jelly', M: 1, D: 2, F: 6, S: 0, n: 4, gap: 0.55, x: 0.55, spd: 70, hp: 2 },
  // 첫 사격 (움직이면 피해진다 교육) + 위쪽 셔틀 겹침
  { t: 14,   kind: 'fish', M: 2, D: 1, F: 2, S: 1, n: 5, gap: 0.45, y: 0.3, amp: 25, freq: 3, spd: 110, hp: 2, fireInt: 2.4 },
  { t: 17.5, kind: 'fish', M: 2, D: 1, F: 2, S: 1, n: 5, gap: 0.45, y: 0.7, amp: 25, freq: 3, spd: 110, hp: 2, fireInt: 2.4 },
  { t: 18.5, kind: 'fish', M: 2, D: 1, F: 2, S: 0, n: 5, gap: 0.3, y: 0.15, amp: 18, freq: 3, spd: 135, hp: 2 },
  // 벽 (틈 찾기 교육)
  { t: 22.5, kind: 'fish', M: 1, D: 1, F: 4, S: 0, n: 7, y: 0.5, spd: 100, hp: 2 },
  // 해파리 비 + 아래 셔틀
  { t: 26,   kind: 'jelly', M: 1, D: 2, F: 6, S: 3, n: 5, gap: 0.65, x: 0.65, spd: 60, hp: 2, fireInt: 1.1 },
  { t: 27,   kind: 'fish', M: 2, D: 1, F: 2, S: 0, n: 5, gap: 0.3, y: 0.8, amp: 20, freq: 3, spd: 130, hp: 2 },
  // 쉼표 (막 전환)
  { t: 31,   kind: 'fish', M: 2, D: 1, F: 2, S: 0, n: 8, gap: 0.26, y: 0.45, amp: 45, freq: 2.8, spd: 140, hp: 2 },

  // ===== 2막: 압박 상승 =====
  { t: 35,   kind: 'ray', M: 3, D: 1, F: 3, S: 1, n: 5, y: 0.5, spd: 130, hp: 4, targetX: 0.68, fireInt: 1.4, pauseDur: 3.2 },
  // 대물 1호 (정지 살포) + 위 셔틀 겹침
  { t: 39,   kind: 'big', M: 3, D: 1, F: 1, S: 2, n: 1, y: 0.4, spd: 90, hp: 32, targetX: 0.74, fireInt: 1.9, pauseDur: 6.5, ringN: 10 },
  { t: 41,   kind: 'fish', M: 2, D: 1, F: 2, S: 0, n: 6, gap: 0.3, y: 0.15, amp: 18, freq: 3, spd: 135, hp: 2 },
  // 포대 + 상공 셔틀
  { t: 45,   kind: 'turret', M: 6, D: 1, F: 1, S: 2, n: 1, y: 0.93, spd: 0, hp: 7, fireInt: 2.8 },
  { t: 46,   kind: 'fish', M: 2, D: 1, F: 2, S: 0, n: 7, gap: 0.28, y: 0.25, amp: 30, freq: 3, spd: 125, hp: 2 },
  // 부상 해파리 + 조준 종대
  { t: 50,   kind: 'jelly', M: 1, D: 3, F: 6, S: 0, n: 5, gap: 0.5, x: 0.55, spd: 65, hp: 2 },
  { t: 51.5, kind: 'fish', M: 2, D: 1, F: 2, S: 1, n: 4, gap: 0.45, y: 0.3, amp: 22, freq: 3, spd: 115, hp: 2, fireInt: 2.2 },
  // 상하 이중 조준 종대
  { t: 55.5, kind: 'fish', M: 2, D: 1, F: 2, S: 1, n: 5, gap: 0.42, y: 0.25, amp: 22, freq: 3, spd: 115, hp: 2, fireInt: 2.2 },
  { t: 56,   kind: 'fish', M: 2, D: 1, F: 2, S: 1, n: 5, gap: 0.42, y: 0.75, amp: 22, freq: 3, spd: 115, hp: 2, fireInt: 2.2 },
  // 벽 2 + 낙하 소량
  { t: 60.5, kind: 'fish', M: 1, D: 1, F: 4, S: 0, n: 9, y: 0.5, spd: 110, hp: 2 },
  { t: 61.5, kind: 'jelly', M: 1, D: 2, F: 6, S: 0, n: 3, gap: 0.5, x: 0.4, spd: 68, hp: 2 },
  // 해파리 비 + 조준 복합
  { t: 65,   kind: 'jelly', M: 1, D: 2, F: 6, S: 3, n: 6, gap: 0.55, x: 0.5, spd: 65, hp: 2, fireInt: 1.0 },
  { t: 66.5, kind: 'fish', M: 2, D: 1, F: 2, S: 1, n: 4, gap: 0.5, y: 0.75, amp: 20, freq: 3, spd: 115, hp: 2, fireInt: 2.2 },
  // 가오리 V 2차 + 아래 셔틀
  { t: 70.5, kind: 'ray', M: 3, D: 1, F: 3, S: 1, n: 5, y: 0.32, spd: 130, hp: 4, targetX: 0.66, fireInt: 1.2, pauseDur: 3.2 },
  { t: 72,   kind: 'fish', M: 2, D: 1, F: 2, S: 0, n: 5, gap: 0.3, y: 0.82, amp: 18, freq: 3, spd: 135, hp: 2 },

  // ===== 3막: 혼합 + 파밍 =====
  // 포대 2연속 + 상공 셔틀
  { t: 76.5, kind: 'turret', M: 6, D: 1, F: 1, S: 2, n: 1, y: 0.93, spd: 0, hp: 7, fireInt: 2.6 },
  { t: 77,   kind: 'fish', M: 2, D: 1, F: 2, S: 0, n: 7, gap: 0.28, y: 0.2, amp: 28, freq: 3, spd: 130, hp: 2 },
  { t: 79,   kind: 'turret', M: 6, D: 1, F: 1, S: 2, n: 1, y: 0.93, spd: 0, hp: 7, fireInt: 2.6 },
  // 대물 2호 (횡단 살포) + 해파리 비
  { t: 82,   kind: 'big', M: 2, D: 1, F: 1, S: 2, n: 1, y: 0.5, amp: 40, freq: 0.8, spd: 85, hp: 32, fireInt: 2.0, ringN: 12 },
  { t: 83.5, kind: 'jelly', M: 1, D: 2, F: 6, S: 3, n: 5, gap: 0.55, x: 0.6, spd: 62, hp: 2, fireInt: 1.0 },
  // 부상 + 조준 종대
  { t: 88,   kind: 'jelly', M: 1, D: 3, F: 6, S: 0, n: 4, gap: 0.55, x: 0.4, spd: 60, hp: 2 },
  { t: 89,   kind: 'fish', M: 2, D: 1, F: 2, S: 1, n: 5, gap: 0.42, y: 0.5, amp: 35, freq: 3, spd: 120, hp: 2, fireInt: 2.0 },
  // 벽 3 + 조준 종대 겹침
  { t: 93.5, kind: 'fish', M: 1, D: 1, F: 4, S: 0, n: 9, y: 0.5, spd: 115, hp: 2 },
  { t: 95,   kind: 'fish', M: 2, D: 1, F: 2, S: 1, n: 4, gap: 0.42, y: 0.2, amp: 20, freq: 3, spd: 125, hp: 2, fireInt: 2.2 },
  // 해파리 비 마지막
  { t: 99,   kind: 'jelly', M: 1, D: 2, F: 6, S: 3, n: 5, gap: 0.55, x: 0.5, spd: 64, hp: 2, fireInt: 1.0 },
  // 최종 파밍 러시 (보스 전 파워 복구)
  { t: 102.5, kind: 'fish', M: 2, D: 1, F: 2, S: 0, n: 8, gap: 0.24, y: 0.3, amp: 35, freq: 3, spd: 145, hp: 2 },
  { t: 104,  kind: 'fish', M: 2, D: 1, F: 2, S: 0, n: 8, gap: 0.24, y: 0.7, amp: 35, freq: 3, spd: 145, hp: 2 },

  { t: 110, warning: true },
  { t: 114, boss: true },
];

// ------------------------------------------------------------
// 스테이지 2 "해파리 초원": D2·D3 세로축 편중 + S4(설치 기뢰).
// 커튼(D2×F4) = 세로 스테이지의 벽. 등불 해파리 = 단단+기뢰.
// 3막: 저녁 초원(0~33) → 등불이 늘어난다(37~72) → 반짝이는 초원(76~108) → 보스 114
// ------------------------------------------------------------
const STAGE2_TIMELINE = [
  // ===== 1막: 저녁 초원 =====
  { t: 2,    kind: 'fish', M: 2, D: 1, F: 2, S: 0, n: 6, gap: 0.32, y: 0.4, amp: 30, freq: 3, spd: 125, hp: 2 },
  { t: 4.5,  kind: 'jelly', M: 1, D: 2, F: 6, S: 0, n: 5, gap: 0.5, x: 0.5, spd: 70, hp: 2 },
  { t: 8,    kind: 'jelly', M: 1, D: 3, F: 6, S: 0, n: 5, gap: 0.5, x: 0.45, spd: 65, hp: 2 },
  { t: 9.5,  kind: 'fish', M: 2, D: 1, F: 2, S: 0, n: 5, gap: 0.3, y: 0.25, amp: 20, freq: 3, spd: 130, hp: 2 },
  // 첫 낙하탄 + 아래 셔틀
  { t: 13,   kind: 'jelly', M: 1, D: 2, F: 6, S: 3, n: 5, gap: 0.55, x: 0.6, spd: 62, hp: 2, fireInt: 1.1 },
  { t: 14.5, kind: 'fish', M: 2, D: 1, F: 2, S: 0, n: 6, gap: 0.28, y: 0.75, amp: 25, freq: 2.8, spd: 130, hp: 2 },
  // 커튼 첫 경험
  { t: 18.5, kind: 'jelly', M: 1, D: 2, F: 4, S: 0, n: 9, spd: 85, hp: 2 },
  // 등불 데뷔 (기뢰 교육) + 낙하 소량
  { t: 22,   kind: 'lantern', M: 2, D: 1, F: 1, S: 4, n: 1, y: 0.5, amp: 25, freq: 1.5, spd: 55, hp: 4, fireInt: 2.6 },
  { t: 23.5, kind: 'jelly', M: 1, D: 2, F: 6, S: 0, n: 4, gap: 0.5, x: 0.4, spd: 68, hp: 2 },
  // 낙하탄 + 부상 샌드위치
  { t: 27.5, kind: 'jelly', M: 1, D: 2, F: 6, S: 3, n: 5, gap: 0.55, x: 0.55, spd: 64, hp: 2, fireInt: 1.1 },
  { t: 28.5, kind: 'jelly', M: 1, D: 3, F: 6, S: 0, n: 4, gap: 0.55, x: 0.4, spd: 62, hp: 2 },
  // 쉼표
  { t: 32.5, kind: 'fish', M: 2, D: 1, F: 2, S: 0, n: 8, gap: 0.26, y: 0.45, amp: 45, freq: 2.8, spd: 140, hp: 2 },

  // ===== 2막: 등불이 늘어난다 =====
  { t: 37,   kind: 'lantern', M: 2, D: 1, F: 2, S: 4, n: 3, gap: 1.1, y: 0.35, amp: 25, freq: 1.5, spd: 58, hp: 4, fireInt: 2.4 },
  { t: 38.5, kind: 'jelly', M: 1, D: 2, F: 6, S: 0, n: 4, gap: 0.5, x: 0.55, spd: 68, hp: 2 },
  // 커튼 2 + 위 셔틀
  { t: 43,   kind: 'jelly', M: 1, D: 2, F: 4, S: 0, n: 9, spd: 90, hp: 2 },
  { t: 44.5, kind: 'fish', M: 2, D: 1, F: 2, S: 0, n: 6, gap: 0.28, y: 0.3, amp: 22, freq: 3, spd: 132, hp: 2 },
  // 낙하탄 + 아래 조준
  { t: 48.5, kind: 'jelly', M: 1, D: 2, F: 6, S: 3, n: 6, gap: 0.5, x: 0.55, spd: 64, hp: 2, fireInt: 1.0 },
  { t: 50,   kind: 'fish', M: 2, D: 1, F: 2, S: 1, n: 4, gap: 0.5, y: 0.8, amp: 20, freq: 3, spd: 118, hp: 2, fireInt: 2.2 },
  // 대물 1호 (횡단) + 부상 겹침
  { t: 54,   kind: 'big', M: 2, D: 1, F: 1, S: 2, n: 1, y: 0.45, amp: 50, freq: 0.7, spd: 85, hp: 40, fireInt: 1.9, ringN: 12 },
  { t: 55.5, kind: 'jelly', M: 1, D: 3, F: 6, S: 0, n: 4, gap: 0.5, x: 0.45, spd: 64, hp: 2 },
  // 정지 설치 등불 + 낙하탄
  { t: 60,   kind: 'lantern', M: 3, D: 1, F: 1, S: 4, n: 1, y: 0.6, spd: 95, hp: 5, targetX: 0.7, fireInt: 1.5, pauseDur: 4.0 },
  { t: 61,   kind: 'jelly', M: 1, D: 2, F: 6, S: 3, n: 5, gap: 0.5, x: 0.5, spd: 66, hp: 2, fireInt: 1.1 },
  // 커튼 3 + 위 셔틀
  { t: 65.5, kind: 'jelly', M: 1, D: 2, F: 4, S: 0, n: 10, spd: 92, hp: 2 },
  { t: 67,   kind: 'fish', M: 2, D: 1, F: 2, S: 0, n: 7, gap: 0.28, y: 0.3, amp: 30, freq: 3, spd: 132, hp: 2 },
  // 등불 삼형제 + 낙하 소량
  { t: 71,   kind: 'lantern', M: 2, D: 1, F: 2, S: 4, n: 3, gap: 1.0, y: 0.5, amp: 35, freq: 1.4, spd: 60, hp: 4, fireInt: 2.4 },
  { t: 72.5, kind: 'jelly', M: 1, D: 2, F: 6, S: 0, n: 4, gap: 0.5, x: 0.35, spd: 68, hp: 2 },

  // ===== 3막: 반짝이는 초원 =====
  { t: 77,   kind: 'jelly', M: 1, D: 2, F: 6, S: 3, n: 7, gap: 0.45, x: 0.5, spd: 66, hp: 2, fireInt: 1.0 },
  { t: 78,   kind: 'jelly', M: 1, D: 3, F: 6, S: 0, n: 5, gap: 0.5, x: 0.55, spd: 64, hp: 2 },
  // 대물 2호 (정지 살포) → 커튼 겹침 (틈 읽기 복합)
  { t: 82.5, kind: 'big', M: 3, D: 1, F: 1, S: 2, n: 1, y: 0.55, spd: 90, hp: 40, targetX: 0.72, fireInt: 1.7, pauseDur: 6.5, ringN: 12 },
  { t: 85.5, kind: 'jelly', M: 1, D: 2, F: 4, S: 0, n: 10, spd: 95, hp: 2 },
  // 두 지점 동시 설치 + 낙하탄
  { t: 90,   kind: 'lantern', M: 3, D: 1, F: 1, S: 4, n: 1, y: 0.3, spd: 95, hp: 5, targetX: 0.72, fireInt: 1.5, pauseDur: 3.5 },
  { t: 91,   kind: 'lantern', M: 3, D: 1, F: 1, S: 4, n: 1, y: 0.7, spd: 95, hp: 5, targetX: 0.66, fireInt: 1.5, pauseDur: 3.5 },
  { t: 92.5, kind: 'jelly', M: 1, D: 2, F: 6, S: 3, n: 5, gap: 0.5, x: 0.45, spd: 66, hp: 2, fireInt: 1.1 },
  // 낙하탄 최대 + 조준 종대
  { t: 97,   kind: 'jelly', M: 1, D: 2, F: 6, S: 3, n: 7, gap: 0.45, x: 0.45, spd: 68, hp: 2, fireInt: 1.0 },
  { t: 98.5, kind: 'fish', M: 2, D: 1, F: 2, S: 1, n: 5, gap: 0.42, y: 0.5, amp: 35, freq: 3, spd: 122, hp: 2, fireInt: 2.0 },
  // 커튼 피날레 + 파밍 러시
  { t: 102.5, kind: 'jelly', M: 1, D: 2, F: 4, S: 0, n: 10, spd: 95, hp: 2 },
  { t: 104,  kind: 'fish', M: 2, D: 1, F: 2, S: 0, n: 8, gap: 0.24, y: 0.35, amp: 35, freq: 3, spd: 145, hp: 2 },
  { t: 105.5, kind: 'fish', M: 2, D: 1, F: 2, S: 0, n: 8, gap: 0.24, y: 0.65, amp: 35, freq: 3, spd: 145, hp: 2 },

  { t: 110, warning: true },
  { t: 114, boss: true },
];

// ------------------------------------------------------------
// 스테이지 3 "거북이 고속도로": 속도의 스테이지.
// D5(등 뒤 추월)·M4(유턴)·S5(유언탄) + 가오리 편대전 + 거북 택시(ride).
// 3막: 진입로(0~31) → 거북 택시(35~57) → 하이웨이 러시(62~112) → 보스 120
// ------------------------------------------------------------
const STAGE3_TIMELINE = [
  // ===== 1막: 진입로 =====
  { t: 2,    kind: 'fish', M: 2, D: 1, F: 2, S: 0, n: 6, gap: 0.24, y: 0.4, amp: 20, freq: 3.5, spd: 195, hp: 2 },
  { t: 4,    kind: 'fish', M: 2, D: 1, F: 2, S: 0, n: 6, gap: 0.24, y: 0.6, amp: 20, freq: 3.5, spd: 195, hp: 2 },
  { t: 7.5,  kind: 'ray', M: 3, D: 1, F: 3, S: 1, n: 3, y: 0.5, spd: 150, hp: 4, targetX: 0.68, fireInt: 1.5, pauseDur: 2.6 },
  // D5 데뷔 + 정방향 셔틀 교행
  { t: 11.5, kind: 'fish', M: 2, D: 5, F: 2, S: 0, n: 6, gap: 0.28, y: 0.5, amp: 25, freq: 3, spd: 210, hp: 2 },
  { t: 12.5, kind: 'fish', M: 2, D: 1, F: 2, S: 0, n: 5, gap: 0.26, y: 0.25, amp: 18, freq: 3.5, spd: 200, hp: 2 },
  // 조준 + M4 유턴 데뷔
  { t: 16.5, kind: 'fish', M: 2, D: 1, F: 2, S: 1, n: 5, gap: 0.38, y: 0.3, amp: 22, freq: 3, spd: 150, hp: 2, fireInt: 2.2 },
  { t: 18,   kind: 'fish', M: 4, D: 1, F: 2, S: 0, n: 5, gap: 0.32, y: 0.55, spd: 160, hp: 2 },
  // 가오리 V + 아래 셔틀
  { t: 22,   kind: 'ray', M: 3, D: 1, F: 3, S: 1, n: 5, y: 0.45, spd: 150, hp: 4, targetX: 0.66, fireInt: 1.3, pauseDur: 3.0 },
  { t: 23.5, kind: 'fish', M: 2, D: 1, F: 2, S: 0, n: 5, gap: 0.26, y: 0.8, amp: 18, freq: 3.5, spd: 200, hp: 2 },
  // 양방향 교행 (시그니처 컷)
  { t: 27.5, kind: 'fish', M: 2, D: 1, F: 2, S: 0, n: 7, gap: 0.24, y: 0.3, amp: 18, freq: 3.5, spd: 200, hp: 2 },
  { t: 28,   kind: 'fish', M: 2, D: 5, F: 2, S: 0, n: 7, gap: 0.24, y: 0.7, amp: 18, freq: 3.5, spd: 200, hp: 2 },
  // 쉼표
  { t: 31.5, kind: 'fish', M: 2, D: 1, F: 2, S: 0, n: 8, gap: 0.2, y: 0.5, amp: 40, freq: 3, spd: 210, hp: 2 },

  // ===== 2막: 거북 택시 =====
  { t: 35,   ride: 22 },
  { t: 37,   kind: 'fish', M: 2, D: 1, F: 2, S: 0, n: 7, gap: 0.18, y: 0.3, amp: 25, freq: 3, spd: 230, hp: 2 },
  { t: 40,   kind: 'fish', M: 2, D: 1, F: 2, S: 0, n: 7, gap: 0.18, y: 0.7, amp: 25, freq: 3, spd: 230, hp: 2 },
  { t: 43,   kind: 'fish', M: 2, D: 1, F: 2, S: 0, n: 8, gap: 0.16, y: 0.5, amp: 50, freq: 3, spd: 240, hp: 2 },
  { t: 46,   kind: 'fish', M: 2, D: 1, F: 2, S: 0, n: 7, gap: 0.18, y: 0.35, amp: 30, freq: 3, spd: 230, hp: 2 },
  { t: 49,   kind: 'fish', M: 2, D: 1, F: 2, S: 0, n: 7, gap: 0.18, y: 0.65, amp: 30, freq: 3, spd: 230, hp: 2 },
  { t: 52,   kind: 'fish', M: 2, D: 1, F: 2, S: 0, n: 8, gap: 0.16, y: 0.5, amp: 45, freq: 3, spd: 240, hp: 2 },

  // ===== 3막: 하이웨이 러시 =====
  // 상하 가오리 협공
  { t: 62,   kind: 'ray', M: 3, D: 1, F: 3, S: 1, n: 5, y: 0.3, spd: 155, hp: 4, targetX: 0.7, fireInt: 1.3, pauseDur: 3.0 },
  { t: 63,   kind: 'ray', M: 3, D: 1, F: 3, S: 1, n: 5, y: 0.7, spd: 155, hp: 4, targetX: 0.64, fireInt: 1.3, pauseDur: 3.0 },
  // 대물 1호 (정지 살포) + S5 유언탄 데뷔
  { t: 67.5, kind: 'big', M: 3, D: 1, F: 1, S: 2, n: 1, y: 0.5, spd: 110, hp: 48, targetX: 0.72, fireInt: 1.7, pauseDur: 6.0, ringN: 12 },
  { t: 69,   kind: 'fish', M: 2, D: 1, F: 2, S: 5, n: 5, gap: 0.38, y: 0.25, amp: 30, freq: 3, spd: 150, hp: 2 },
  // 등 뒤 조준 + 정방향 셔틀
  { t: 73.5, kind: 'fish', M: 2, D: 5, F: 2, S: 1, n: 4, gap: 0.45, y: 0.55, amp: 22, freq: 3, spd: 165, hp: 2, fireInt: 2.4 },
  { t: 74.5, kind: 'fish', M: 2, D: 1, F: 2, S: 0, n: 5, gap: 0.26, y: 0.2, amp: 18, freq: 3.5, spd: 200, hp: 2 },
  // 유턴 유언탄 + 아래 조준
  { t: 78.5, kind: 'fish', M: 4, D: 1, F: 2, S: 5, n: 5, gap: 0.32, y: 0.4, spd: 165, hp: 2 },
  { t: 80,   kind: 'fish', M: 2, D: 1, F: 2, S: 1, n: 4, gap: 0.38, y: 0.75, amp: 22, freq: 3, spd: 158, hp: 2, fireInt: 2.2 },
  // 가오리 V + D5 교행
  { t: 84,   kind: 'ray', M: 3, D: 1, F: 3, S: 1, n: 5, y: 0.5, spd: 155, hp: 4, targetX: 0.68, fireInt: 1.2, pauseDur: 3.2 },
  { t: 85.5, kind: 'fish', M: 2, D: 5, F: 2, S: 0, n: 6, gap: 0.26, y: 0.2, amp: 20, freq: 3.5, spd: 210, hp: 2 },
  // 벽 + 조준 종대
  { t: 90,   kind: 'fish', M: 1, D: 1, F: 4, S: 0, n: 9, y: 0.5, spd: 170, hp: 2 },
  { t: 91.5, kind: 'fish', M: 2, D: 1, F: 2, S: 1, n: 5, gap: 0.32, y: 0.5, amp: 25, freq: 3, spd: 160, hp: 2, fireInt: 2.0 },
  // 대물 2호 (고속 횡단) + 상하 조준 협공
  { t: 95.5, kind: 'big', M: 2, D: 1, F: 1, S: 2, n: 1, y: 0.45, amp: 35, freq: 0.9, spd: 105, hp: 48, fireInt: 1.8, ringN: 14 },
  { t: 96.5, kind: 'fish', M: 2, D: 1, F: 2, S: 1, n: 5, gap: 0.32, y: 0.2, amp: 25, freq: 3, spd: 160, hp: 2, fireInt: 2.0 },
  { t: 97,   kind: 'fish', M: 2, D: 1, F: 2, S: 1, n: 5, gap: 0.32, y: 0.75, amp: 25, freq: 3, spd: 160, hp: 2, fireInt: 2.0 },
  // 편대전 피날레
  { t: 101.5, kind: 'ray', M: 3, D: 1, F: 3, S: 1, n: 5, y: 0.35, spd: 160, hp: 4, targetX: 0.7, fireInt: 1.2, pauseDur: 3.0 },
  { t: 104.5, kind: 'ray', M: 3, D: 1, F: 3, S: 1, n: 5, y: 0.65, spd: 160, hp: 4, targetX: 0.64, fireInt: 1.2, pauseDur: 3.0 },
  // 최종 파밍 러시
  { t: 109,  kind: 'fish', M: 2, D: 1, F: 2, S: 0, n: 8, gap: 0.2, y: 0.35, amp: 35, freq: 3, spd: 220, hp: 2 },
  { t: 110.5, kind: 'fish', M: 2, D: 1, F: 2, S: 0, n: 8, gap: 0.2, y: 0.65, amp: 35, freq: 3, spd: 220, hp: 2 },

  { t: 116, warning: true },
  { t: 120, boss: true },
];

// ------------------------------------------------------------
// 스테이지 4 "심해 협곡": 어둠의 스테이지 (dark: 0.8).
// 광원 = 플레이어 주변·등불 해파리(이 스테이지에선 S0 광원 운반자)·기뢰·보스 초롱.
// 시그니처 선택: 등불을 잡으면 진주, 살려두면 시야.
// 신규 부품 — M5(완만 추적): 어둠 속에서 형광 눈만 번뜩이며 다가오는 독니고기(viper).
// 3막: 어둠 적응(0~32) → 협곡 깊이(35~72) → 심해 러시(76~108) → 보스 114
// ------------------------------------------------------------
const STAGE4_TIMELINE = [
  // ===== 1막: 어둠 적응 =====
  { t: 2,    kind: 'lantern', M: 2, D: 1, F: 1, S: 0, n: 1, y: 0.5, amp: 30, freq: 1.2, spd: 50, hp: 5 },
  { t: 3.5,  kind: 'fish', M: 2, D: 1, F: 2, S: 0, n: 6, gap: 0.32, y: 0.35, amp: 30, freq: 3, spd: 120, hp: 2 },
  { t: 6.5,  kind: 'fish', M: 2, D: 1, F: 2, S: 0, n: 6, gap: 0.32, y: 0.65, amp: 30, freq: 3, spd: 120, hp: 2 },
  { t: 8,    kind: 'jelly', M: 1, D: 2, F: 6, S: 0, n: 4, gap: 0.55, x: 0.5, spd: 68, hp: 2 },
  // 광원 옆에서 첫 사격
  { t: 11,   kind: 'lantern', M: 2, D: 1, F: 1, S: 0, n: 1, y: 0.3, amp: 25, freq: 1.3, spd: 52, hp: 5 },
  { t: 12,   kind: 'fish', M: 2, D: 1, F: 2, S: 1, n: 5, gap: 0.45, y: 0.7, amp: 25, freq: 3, spd: 110, hp: 2, fireInt: 2.4 },
  // 독니고기 데뷔: 어둠 속 눈 두 쌍이 다가온다
  { t: 15.5, kind: 'viper', M: 5, D: 1, F: 1, S: 0, n: 2, gap: 1.0, y: 0.4, spd: 115, hp: 3 },
  { t: 18.5, kind: 'fish', M: 2, D: 1, F: 2, S: 0, n: 6, gap: 0.3, y: 0.25, amp: 22, freq: 3, spd: 125, hp: 2 },
  { t: 20,   kind: 'jelly', M: 1, D: 3, F: 6, S: 0, n: 4, gap: 0.55, x: 0.5, spd: 62, hp: 2 },
  { t: 23,   kind: 'lantern', M: 2, D: 1, F: 1, S: 0, n: 1, y: 0.6, amp: 30, freq: 1.2, spd: 52, hp: 5 },
  { t: 24,   kind: 'viper', M: 5, D: 1, F: 1, S: 0, n: 3, gap: 0.9, y: 0.55, spd: 118, hp: 3 },
  // 어둠 커튼
  { t: 27.5, kind: 'jelly', M: 1, D: 2, F: 4, S: 0, n: 9, spd: 85, hp: 2 },
  // 쉼표
  { t: 31,   kind: 'fish', M: 2, D: 1, F: 2, S: 0, n: 8, gap: 0.26, y: 0.45, amp: 45, freq: 2.8, spd: 140, hp: 2 },

  // ===== 2막: 협곡 깊이 =====
  // 빛 줄기 (등불 삼형제) + 낙하탄
  { t: 35,   kind: 'lantern', M: 2, D: 1, F: 2, S: 0, n: 3, gap: 1.1, y: 0.4, amp: 28, freq: 1.2, spd: 55, hp: 5 },
  { t: 36.5, kind: 'jelly', M: 1, D: 2, F: 6, S: 3, n: 5, gap: 0.55, x: 0.55, spd: 62, hp: 2, fireInt: 1.1 },
  { t: 40.5, kind: 'viper', M: 5, D: 1, F: 1, S: 0, n: 3, gap: 0.9, y: 0.45, spd: 120, hp: 3 },
  { t: 41.5, kind: 'fish', M: 2, D: 1, F: 2, S: 1, n: 4, gap: 0.45, y: 0.25, amp: 22, freq: 3, spd: 115, hp: 2, fireInt: 2.2 },
  // 심해 대물 + 등불 겹침
  { t: 45.5, kind: 'big', M: 3, D: 1, F: 1, S: 2, n: 1, y: 0.5, spd: 95, hp: 55, targetX: 0.72, fireInt: 1.7, pauseDur: 6.5, ringN: 12 },
  { t: 47,   kind: 'lantern', M: 2, D: 1, F: 1, S: 0, n: 1, y: 0.25, amp: 25, freq: 1.3, spd: 54, hp: 5 },
  { t: 51.5, kind: 'jelly', M: 1, D: 2, F: 6, S: 3, n: 6, gap: 0.5, x: 0.5, spd: 64, hp: 2, fireInt: 1.0 },
  { t: 53,   kind: 'viper', M: 5, D: 1, F: 1, S: 0, n: 3, gap: 0.9, y: 0.6, spd: 122, hp: 3 },
  // 커튼 + 위 셔틀
  { t: 57,   kind: 'jelly', M: 1, D: 2, F: 4, S: 0, n: 10, spd: 90, hp: 2 },
  { t: 58.5, kind: 'fish', M: 2, D: 1, F: 2, S: 0, n: 6, gap: 0.28, y: 0.3, amp: 22, freq: 3, spd: 130, hp: 2 },
  // 광원 파킹 (정지 등불) + 부상 낙하탄
  { t: 62.5, kind: 'lantern', M: 3, D: 1, F: 1, S: 0, n: 1, y: 0.5, spd: 90, hp: 6, targetX: 0.55, pauseDur: 8.0 },
  { t: 63.5, kind: 'jelly', M: 1, D: 3, F: 6, S: 3, n: 5, gap: 0.5, x: 0.5, spd: 64, hp: 2, fireInt: 1.1 },
  // 독니 러시 + 이중 조준
  { t: 68,   kind: 'viper', M: 5, D: 1, F: 1, S: 0, n: 4, gap: 0.8, y: 0.5, spd: 125, hp: 3 },
  { t: 69.5, kind: 'fish', M: 2, D: 1, F: 2, S: 1, n: 4, gap: 0.42, y: 0.2, amp: 20, freq: 3, spd: 118, hp: 2, fireInt: 2.2 },

  // ===== 3막: 심해 러시 =====
  { t: 76,   kind: 'jelly', M: 1, D: 2, F: 6, S: 3, n: 7, gap: 0.45, x: 0.5, spd: 64, hp: 2, fireInt: 1.0 },
  { t: 77,   kind: 'viper', M: 5, D: 1, F: 1, S: 0, n: 3, gap: 0.9, y: 0.35, spd: 122, hp: 3 },
  // 대물 횡단 + 등불
  { t: 81.5, kind: 'big', M: 2, D: 1, F: 1, S: 2, n: 1, y: 0.45, amp: 40, freq: 0.8, spd: 90, hp: 55, fireInt: 1.8, ringN: 14 },
  { t: 83,   kind: 'lantern', M: 2, D: 1, F: 1, S: 0, n: 1, y: 0.7, amp: 25, freq: 1.3, spd: 54, hp: 5 },
  // 커튼 + 조준 종대
  { t: 87.5, kind: 'jelly', M: 1, D: 2, F: 4, S: 0, n: 10, spd: 92, hp: 2 },
  { t: 89,   kind: 'fish', M: 2, D: 1, F: 2, S: 1, n: 5, gap: 0.42, y: 0.5, amp: 30, freq: 3, spd: 120, hp: 2, fireInt: 2.0 },
  // 독니 최대 러시 + 빛 줄기
  { t: 93.5, kind: 'viper', M: 5, D: 1, F: 1, S: 0, n: 5, gap: 0.7, y: 0.5, spd: 128, hp: 3 },
  { t: 95,   kind: 'lantern', M: 2, D: 1, F: 2, S: 0, n: 3, gap: 1.0, y: 0.35, amp: 28, freq: 1.2, spd: 56, hp: 5 },
  // 낙하 + 부상 샌드위치
  { t: 99.5, kind: 'jelly', M: 1, D: 2, F: 6, S: 3, n: 6, gap: 0.5, x: 0.55, spd: 66, hp: 2, fireInt: 1.0 },
  { t: 100.5, kind: 'jelly', M: 1, D: 3, F: 6, S: 0, n: 4, gap: 0.5, x: 0.4, spd: 62, hp: 2 },
  // 최종 파밍 러시
  { t: 104.5, kind: 'fish', M: 2, D: 1, F: 2, S: 0, n: 8, gap: 0.24, y: 0.35, amp: 35, freq: 3, spd: 145, hp: 2 },
  { t: 106,  kind: 'fish', M: 2, D: 1, F: 2, S: 0, n: 8, gap: 0.24, y: 0.65, amp: 35, freq: 3, spd: 145, hp: 2 },

  { t: 111, warning: true },
  { t: 115, boss: true },
];

// ------------------------------------------------------------
// 스테이지 5 "난파선 묘지": 지형의 스테이지 (+옅은 탁류 dark 0.3).
// 신규 부품 — wreck(지형 장애물: 통로 좁힘, 불괴, 접촉 피격),
//   유령 물고기(ghost: 실체↔반투명 무적 사이클 — 리듬을 읽고 잡는다),
//   D4(대각 진입)·F5(포위 링) 데뷔.
// 3막: 잔해 사이로(0~33) → 유령의 시간(35~72) → 좁아지는 묘지(76~108) → 보스 115
// ------------------------------------------------------------
const STAGE5_TIMELINE = [
  // ===== 1막: 잔해 사이로 =====
  { t: 2,    kind: 'fish', M: 2, D: 1, F: 2, S: 0, n: 6, gap: 0.32, y: 0.35, amp: 30, freq: 3, spd: 125, hp: 2 },
  { t: 4.5,  kind: 'fish', M: 2, D: 1, F: 2, S: 0, n: 6, gap: 0.32, y: 0.65, amp: 30, freq: 3, spd: 125, hp: 2 },
  // 지형 데뷔: 아래에서 잔해 — 위로 피해라
  { t: 8,    kind: 'wreck', side: 'bot', frac: 0.38, spd: 95 },
  { t: 9,    kind: 'fish', M: 2, D: 1, F: 2, S: 0, n: 6, gap: 0.3, y: 0.22, amp: 20, freq: 3, spd: 130, hp: 2 },
  // 유령 데뷔 (무해 — 깜빡임 관찰)
  { t: 13,   kind: 'ghost', M: 2, D: 1, F: 2, S: 0, n: 4, gap: 0.45, y: 0.5, amp: 30, freq: 2.5, spd: 110, hp: 2 },
  { t: 16.5, kind: 'wreck', side: 'top', frac: 0.38, spd: 95 },
  { t: 17.5, kind: 'fish', M: 2, D: 1, F: 2, S: 1, n: 5, gap: 0.45, y: 0.72, amp: 22, freq: 3, spd: 115, hp: 2, fireInt: 2.3 },
  // 유령 대각 진입 (D4 데뷔)
  { t: 21.5, kind: 'ghost', D: 4, S: 0, n: 4, gap: 0.4, spd: 120, hp: 2 },
  { t: 22.5, kind: 'fish', M: 2, D: 1, F: 2, S: 0, n: 5, gap: 0.3, y: 0.8, amp: 18, freq: 3, spd: 130, hp: 2 },
  { t: 26.5, kind: 'wreck', side: 'bot', frac: 0.5, spd: 100 },
  { t: 27.5, kind: 'jelly', M: 1, D: 2, F: 6, S: 3, n: 4, gap: 0.6, x: 0.45, spd: 62, hp: 2, fireInt: 1.1 },
  // 쉼표
  { t: 31.5, kind: 'fish', M: 2, D: 1, F: 2, S: 0, n: 8, gap: 0.26, y: 0.45, amp: 45, freq: 2.8, spd: 140, hp: 2 },

  // ===== 2막: 유령의 시간 =====
  // 난파선 포대 (M6 — 묘지의 파수꾼)
  { t: 35,   kind: 'turret', M: 6, D: 1, F: 1, S: 2, n: 1, y: 0.93, spd: 0, hp: 7, fireInt: 2.6 },
  { t: 36,   kind: 'fish', M: 2, D: 1, F: 2, S: 0, n: 6, gap: 0.28, y: 0.25, amp: 25, freq: 3, spd: 128, hp: 2 },
  { t: 37.5, kind: 'turret', M: 6, D: 1, F: 1, S: 2, n: 1, y: 0.93, spd: 0, hp: 7, fireInt: 2.6 },
  // F5 데뷔: 유령 포위!
  { t: 41,   kind: 'ghost', F: 5, S: 0, n: 8, spd: 60, hp: 2, radius: 300 },
  // 좁은 통로 (상하 동시) + 통로 사이 셔틀
  { t: 45,   kind: 'wreck', side: 'top', frac: 0.32, spd: 100 },
  { t: 45.2, kind: 'wreck', side: 'bot', frac: 0.32, spd: 100 },
  { t: 46.5, kind: 'fish', M: 2, D: 1, F: 2, S: 0, n: 6, gap: 0.28, y: 0.5, amp: 12, freq: 3, spd: 135, hp: 2 },
  { t: 50.5, kind: 'ghost', M: 2, D: 1, F: 2, S: 1, n: 4, gap: 0.45, y: 0.35, amp: 25, freq: 2.5, spd: 112, hp: 2, fireInt: 2.3 },
  { t: 51.5, kind: 'jelly', M: 1, D: 2, F: 6, S: 0, n: 4, gap: 0.5, x: 0.5, spd: 66, hp: 2 },
  // 대물 + 유령 대각 (아래에서)
  { t: 55.5, kind: 'big', M: 3, D: 1, F: 1, S: 2, n: 1, y: 0.5, spd: 95, hp: 60, targetX: 0.72, fireInt: 1.7, pauseDur: 6.5, ringN: 12 },
  { t: 57,   kind: 'ghost', D: 4, dir: 'up', S: 0, n: 4, gap: 0.4, spd: 120, hp: 2 },
  { t: 61.5, kind: 'wreck', side: 'bot', frac: 0.55, spd: 100 },
  { t: 62.5, kind: 'fish', M: 2, D: 1, F: 2, S: 1, n: 4, gap: 0.42, y: 0.22, amp: 18, freq: 3, spd: 120, hp: 2, fireInt: 2.2 },
  // 유령 포위 2차
  { t: 66.5, kind: 'ghost', F: 5, S: 0, n: 10, spd: 62, hp: 2, radius: 310 },
  { t: 68,   kind: 'fish', M: 2, D: 1, F: 2, S: 0, n: 6, gap: 0.28, y: 0.6, amp: 30, freq: 3, spd: 132, hp: 2 },

  // ===== 3막: 좁아지는 묘지 =====
  // 지그재그 통로 (상→하→상) + 사이사이 유령
  { t: 76,   kind: 'wreck', side: 'top', frac: 0.45, spd: 105 },
  { t: 78,   kind: 'ghost', M: 2, D: 1, F: 2, S: 1, n: 4, gap: 0.42, y: 0.75, amp: 20, freq: 2.5, spd: 115, hp: 2, fireInt: 2.2 },
  { t: 80,   kind: 'wreck', side: 'bot', frac: 0.45, spd: 105 },
  { t: 82,   kind: 'jelly', M: 1, D: 2, F: 6, S: 3, n: 5, gap: 0.55, x: 0.4, spd: 64, hp: 2, fireInt: 1.1 },
  { t: 84,   kind: 'wreck', side: 'top', frac: 0.45, spd: 105 },
  // 대물 횡단 + 유령 대각
  { t: 88,   kind: 'big', M: 2, D: 1, F: 1, S: 2, n: 1, y: 0.5, amp: 40, freq: 0.8, spd: 90, hp: 60, fireInt: 1.8, ringN: 14 },
  { t: 89.5, kind: 'ghost', D: 4, S: 0, n: 5, gap: 0.35, spd: 125, hp: 2 },
  // 포위 3차 + 상하 조준 협공
  { t: 94,   kind: 'ghost', F: 5, S: 0, n: 12, spd: 64, hp: 2, radius: 320 },
  { t: 95.5, kind: 'fish', M: 2, D: 1, F: 2, S: 1, n: 5, gap: 0.38, y: 0.25, amp: 22, freq: 3, spd: 122, hp: 2, fireInt: 2.0 },
  { t: 96,   kind: 'fish', M: 2, D: 1, F: 2, S: 1, n: 5, gap: 0.38, y: 0.75, amp: 22, freq: 3, spd: 122, hp: 2, fireInt: 2.0 },
  // 최종 좁은 통로 + 유령 러시
  { t: 100.5, kind: 'wreck', side: 'top', frac: 0.34, spd: 105 },
  { t: 100.7, kind: 'wreck', side: 'bot', frac: 0.34, spd: 105 },
  { t: 102,  kind: 'ghost', M: 2, D: 1, F: 2, S: 0, n: 6, gap: 0.3, y: 0.5, amp: 14, freq: 3, spd: 130, hp: 2 },
  // 최종 파밍 러시
  { t: 105.5, kind: 'fish', M: 2, D: 1, F: 2, S: 0, n: 8, gap: 0.24, y: 0.35, amp: 35, freq: 3, spd: 145, hp: 2 },
  { t: 107,  kind: 'fish', M: 2, D: 1, F: 2, S: 0, n: 8, gap: 0.24, y: 0.65, amp: 35, freq: 3, spd: 145, hp: 2 },

  { t: 111, warning: true },
  { t: 115, boss: true },
];

// ------------------------------------------------------------
// 스테이지 6 "폭풍 수면": 해류의 스테이지 (storm: true).
// 신규 부품 — M7(해류 편승: 흐름 타는 서핑 물고기),
//   스테이지 해류(플레이어·적탄·M7을 진동하며 밀고 당김 — 탄막이 휜다),
//   물속 번개({ t, bolt: x비율 } 한 줄 = 예고 기둥 → 낙뢰),
//   수면 파도(상단 경계 하향).
// 3막: 바람이 분다(0~32) → 폭풍 속으로(35~72) → 뇌우(76~108) → 보스 115
// ------------------------------------------------------------
const STAGE6_TIMELINE = [
  // ===== 1막: 바람이 분다 =====
  { t: 2,    kind: 'fish', M: 7, D: 1, F: 2, S: 0, n: 6, gap: 0.3, y: 0.35, amp: 25, freq: 3, spd: 120, hp: 2 },
  { t: 4.5,  kind: 'fish', M: 7, D: 1, F: 2, S: 0, n: 6, gap: 0.3, y: 0.65, amp: 25, freq: 3, spd: 120, hp: 2 },
  { t: 8,    kind: 'fish', M: 2, D: 1, F: 2, S: 1, n: 5, gap: 0.45, y: 0.3, amp: 22, freq: 3, spd: 115, hp: 2, fireInt: 2.3 },
  { t: 9,    kind: 'jelly', M: 1, D: 2, F: 6, S: 0, n: 4, gap: 0.5, x: 0.5, spd: 72, hp: 2 },
  { t: 12.5, kind: 'ray', M: 3, D: 1, F: 3, S: 1, n: 3, y: 0.5, spd: 145, hp: 4, targetX: 0.68, fireInt: 1.5, pauseDur: 2.8 },
  { t: 16,   kind: 'fish', M: 7, D: 1, F: 2, S: 0, n: 7, gap: 0.28, y: 0.5, amp: 50, freq: 2.8, spd: 125, hp: 2 },
  // 첫 번개 (넉넉하게 혼자)
  { t: 19.5, bolt: 0.42 },
  { t: 20.5, kind: 'fish', M: 2, D: 1, F: 2, S: 0, n: 5, gap: 0.3, y: 0.72, amp: 20, freq: 3, spd: 128, hp: 2 },
  { t: 24,   bolt: 0.62 },
  { t: 24.5, kind: 'jelly', M: 1, D: 2, F: 6, S: 3, n: 4, gap: 0.55, x: 0.45, spd: 68, hp: 2, fireInt: 1.1 },
  { t: 28,   kind: 'fish', M: 7, D: 1, F: 2, S: 0, n: 5, gap: 0.3, y: 0.3, amp: 22, freq: 3, spd: 125, hp: 2 },
  { t: 28.5, kind: 'fish', M: 7, D: 1, F: 2, S: 0, n: 5, gap: 0.3, y: 0.7, amp: 22, freq: 3, spd: 125, hp: 2 },
  { t: 31.5, kind: 'fish', M: 2, D: 1, F: 2, S: 0, n: 8, gap: 0.26, y: 0.45, amp: 45, freq: 2.8, spd: 140, hp: 2 },

  // ===== 2막: 폭풍 속으로 =====
  { t: 35,   kind: 'ray', M: 3, D: 1, F: 3, S: 1, n: 5, y: 0.45, spd: 148, hp: 4, targetX: 0.66, fireInt: 1.3, pauseDur: 3.0 },
  { t: 36.5, kind: 'fish', M: 7, D: 1, F: 2, S: 0, n: 5, gap: 0.3, y: 0.75, amp: 20, freq: 3, spd: 125, hp: 2 },
  // 번개 2연속
  { t: 40,   bolt: 0.3 },
  { t: 40.6, bolt: 0.55 },
  { t: 41.5, kind: 'jelly', M: 1, D: 2, F: 6, S: 3, n: 5, gap: 0.5, x: 0.5, spd: 70, hp: 2, fireInt: 1.0 },
  // 폭풍 대물
  { t: 45.5, kind: 'big', M: 3, D: 1, F: 1, S: 2, n: 1, y: 0.5, spd: 95, hp: 65, targetX: 0.72, fireInt: 1.7, pauseDur: 6.5, ringN: 12 },
  { t: 47,   kind: 'fish', M: 7, D: 1, F: 2, S: 0, n: 5, gap: 0.3, y: 0.22, amp: 18, freq: 3, spd: 128, hp: 2 },
  { t: 51,   bolt: 0.7 },
  { t: 51.7, bolt: 0.45 },
  { t: 52.5, kind: 'fish', M: 2, D: 1, F: 2, S: 1, n: 4, gap: 0.42, y: 0.28, amp: 20, freq: 3, spd: 120, hp: 2, fireInt: 2.2 },
  { t: 53,   kind: 'fish', M: 2, D: 1, F: 2, S: 1, n: 4, gap: 0.42, y: 0.72, amp: 20, freq: 3, spd: 120, hp: 2, fireInt: 2.2 },
  // 폭우 커튼
  { t: 57.5, kind: 'jelly', M: 1, D: 2, F: 4, S: 0, n: 9, spd: 100, hp: 2 },
  { t: 59,   kind: 'fish', M: 7, D: 1, F: 2, S: 0, n: 5, gap: 0.3, y: 0.55, amp: 30, freq: 3, spd: 125, hp: 2 },
  { t: 62.5, kind: 'ray', M: 3, D: 1, F: 3, S: 1, n: 5, y: 0.55, spd: 148, hp: 4, targetX: 0.68, fireInt: 1.2, pauseDur: 3.0 },
  { t: 63.5, bolt: 0.5 },
  { t: 67,   kind: 'fish', M: 2, D: 5, F: 2, S: 1, n: 4, gap: 0.45, y: 0.5, amp: 20, freq: 3, spd: 160, hp: 2, fireInt: 2.4 },
  { t: 68,   kind: 'fish', M: 7, D: 1, F: 2, S: 0, n: 6, gap: 0.28, y: 0.3, amp: 25, freq: 3, spd: 128, hp: 2 },
  { t: 71.5, kind: 'fish', M: 2, D: 1, F: 2, S: 0, n: 8, gap: 0.26, y: 0.5, amp: 40, freq: 2.8, spd: 142, hp: 2 },

  // ===== 3막: 뇌우 =====
  // 번개 스윕 (좌→우)
  { t: 76,   bolt: 0.2 },
  { t: 76.5, bolt: 0.4 },
  { t: 77,   bolt: 0.6 },
  { t: 77.5, bolt: 0.78 },
  { t: 78,   kind: 'fish', M: 7, D: 1, F: 2, S: 0, n: 6, gap: 0.28, y: 0.6, amp: 30, freq: 3, spd: 128, hp: 2 },
  { t: 81.5, kind: 'big', M: 2, D: 1, F: 1, S: 2, n: 1, y: 0.45, amp: 40, freq: 0.8, spd: 92, hp: 65, fireInt: 1.8, ringN: 14 },
  { t: 83,   kind: 'jelly', M: 1, D: 2, F: 6, S: 3, n: 6, gap: 0.5, x: 0.5, spd: 70, hp: 2, fireInt: 1.0 },
  // 가오리 협공
  { t: 87.5, kind: 'ray', M: 3, D: 1, F: 3, S: 1, n: 5, y: 0.3, spd: 150, hp: 4, targetX: 0.7, fireInt: 1.2, pauseDur: 3.0 },
  { t: 88.5, kind: 'ray', M: 3, D: 1, F: 3, S: 1, n: 5, y: 0.7, spd: 150, hp: 4, targetX: 0.64, fireInt: 1.2, pauseDur: 3.0 },
  // 번개 스윕 (우→좌)
  { t: 93,   bolt: 0.72 },
  { t: 93.5, bolt: 0.5 },
  { t: 94,   bolt: 0.28 },
  { t: 94.5, kind: 'fish', M: 2, D: 1, F: 2, S: 1, n: 5, gap: 0.38, y: 0.3, amp: 22, freq: 3, spd: 122, hp: 2, fireInt: 2.0 },
  { t: 95,   kind: 'fish', M: 2, D: 1, F: 2, S: 1, n: 5, gap: 0.38, y: 0.7, amp: 22, freq: 3, spd: 122, hp: 2, fireInt: 2.0 },
  // 폭우 커튼 + 서핑 러시
  { t: 99.5, kind: 'jelly', M: 1, D: 2, F: 4, S: 0, n: 10, spd: 102, hp: 2 },
  { t: 101,  kind: 'fish', M: 7, D: 1, F: 2, S: 0, n: 6, gap: 0.26, y: 0.4, amp: 28, freq: 3, spd: 132, hp: 2 },
  // 쌍둥이 번개 + 최종 파밍 러시
  { t: 103.5, bolt: 0.35 },
  { t: 103.6, bolt: 0.65 },
  { t: 105.5, kind: 'fish', M: 2, D: 1, F: 2, S: 0, n: 8, gap: 0.24, y: 0.35, amp: 35, freq: 3, spd: 145, hp: 2 },
  { t: 107,  kind: 'fish', M: 2, D: 1, F: 2, S: 0, n: 8, gap: 0.24, y: 0.65, amp: 35, freq: 3, spd: 145, hp: 2 },

  { t: 111, warning: true },
  { t: 115, boss: true },
];

// ------------------------------------------------------------
// 스테이지 7 "용궁 앞바다": 최종 시험 — 전 부품 총출동 (약한 폭풍 잔재 storm 0.55).
// 여정에서 배운 모든 문법이 한 번씩 돌아온다. 여명빛 바다, 저 멀리 용궁.
// 3막: 여명(0~33) → 총력(35~74) → 문 앞(76~108) → 라스보스 115
// ------------------------------------------------------------
const STAGE7_TIMELINE = [
  // ===== 1막: 여명 =====
  { t: 2,    kind: 'fish', M: 7, D: 1, F: 2, S: 0, n: 6, gap: 0.3, y: 0.35, amp: 25, freq: 3, spd: 125, hp: 2 },
  { t: 4.5,  kind: 'fish', M: 7, D: 1, F: 2, S: 0, n: 6, gap: 0.3, y: 0.65, amp: 25, freq: 3, spd: 125, hp: 2 },
  // 양방향 교행 (고속도로의 기억)
  { t: 8,    kind: 'fish', M: 2, D: 1, F: 2, S: 0, n: 6, gap: 0.26, y: 0.3, amp: 18, freq: 3.5, spd: 185, hp: 2 },
  { t: 8.5,  kind: 'fish', M: 2, D: 5, F: 2, S: 0, n: 6, gap: 0.26, y: 0.7, amp: 18, freq: 3.5, spd: 185, hp: 2 },
  { t: 12.5, kind: 'ray', M: 3, D: 1, F: 3, S: 1, n: 5, y: 0.5, spd: 150, hp: 4, targetX: 0.68, fireInt: 1.3, pauseDur: 3.0 },
  // 등불의 기억 (기뢰)
  { t: 17,   kind: 'lantern', M: 2, D: 1, F: 1, S: 4, n: 1, y: 0.4, amp: 25, freq: 1.4, spd: 56, hp: 5, fireInt: 2.4 },
  { t: 18.5, kind: 'jelly', M: 1, D: 2, F: 6, S: 3, n: 4, gap: 0.55, x: 0.5, spd: 66, hp: 2, fireInt: 1.1 },
  { t: 22.5, bolt: 0.5 },
  { t: 23,   kind: 'fish', M: 2, D: 1, F: 2, S: 1, n: 5, gap: 0.42, y: 0.7, amp: 22, freq: 3, spd: 120, hp: 2, fireInt: 2.2 },
  // 유령의 기억
  { t: 27,   kind: 'ghost', D: 4, S: 0, n: 4, gap: 0.4, spd: 122, hp: 2 },
  { t: 28.5, kind: 'fish', M: 7, D: 1, F: 2, S: 0, n: 6, gap: 0.28, y: 0.5, amp: 40, freq: 3, spd: 128, hp: 2 },
  { t: 32,   kind: 'fish', M: 2, D: 1, F: 2, S: 0, n: 8, gap: 0.26, y: 0.45, amp: 45, freq: 2.8, spd: 140, hp: 2 },

  // ===== 2막: 총력 =====
  // 유령 포위
  { t: 36,   kind: 'ghost', F: 5, S: 0, n: 10, spd: 62, hp: 2, radius: 310 },
  { t: 37.5, kind: 'fish', M: 7, D: 1, F: 2, S: 0, n: 5, gap: 0.3, y: 0.25, amp: 20, freq: 3, spd: 128, hp: 2 },
  // 난파선의 기억 (좁은 통로)
  { t: 41.5, kind: 'wreck', side: 'top', frac: 0.34, spd: 100 },
  { t: 41.7, kind: 'wreck', side: 'bot', frac: 0.34, spd: 100 },
  { t: 43,   kind: 'fish', M: 2, D: 1, F: 2, S: 0, n: 6, gap: 0.28, y: 0.5, amp: 12, freq: 3, spd: 135, hp: 2 },
  // 최종 대물 1호
  { t: 47.5, kind: 'big', M: 3, D: 1, F: 1, S: 2, n: 1, y: 0.5, spd: 95, hp: 70, targetX: 0.72, fireInt: 1.6, pauseDur: 6.5, ringN: 13 },
  { t: 49,   kind: 'jelly', M: 1, D: 3, F: 6, S: 0, n: 4, gap: 0.5, x: 0.45, spd: 64, hp: 2 },
  // 심해의 기억 (독니고기 추적)
  { t: 53.5, kind: 'viper', M: 5, D: 1, F: 1, S: 0, n: 4, gap: 0.8, y: 0.5, spd: 126, hp: 3 },
  { t: 55,   kind: 'fish', M: 2, D: 1, F: 2, S: 1, n: 4, gap: 0.42, y: 0.25, amp: 20, freq: 3, spd: 122, hp: 2, fireInt: 2.1 },
  // 폭우 커튼 + 번개 쌍
  { t: 59.5, kind: 'jelly', M: 1, D: 2, F: 4, S: 0, n: 10, spd: 98, hp: 2 },
  { t: 61,   bolt: 0.3 },
  { t: 61.6, bolt: 0.6 },
  { t: 62.5, kind: 'fish', M: 7, D: 1, F: 2, S: 0, n: 5, gap: 0.3, y: 0.75, amp: 22, freq: 3, spd: 128, hp: 2 },
  // 가오리 협공
  { t: 66.5, kind: 'ray', M: 3, D: 1, F: 3, S: 1, n: 5, y: 0.3, spd: 152, hp: 4, targetX: 0.7, fireInt: 1.2, pauseDur: 3.0 },
  { t: 67.5, kind: 'ray', M: 3, D: 1, F: 3, S: 1, n: 5, y: 0.7, spd: 152, hp: 4, targetX: 0.64, fireInt: 1.2, pauseDur: 3.0 },
  { t: 71.5, kind: 'fish', M: 2, D: 1, F: 2, S: 0, n: 8, gap: 0.26, y: 0.5, amp: 40, freq: 2.8, spd: 142, hp: 2 },

  // ===== 3막: 문 앞 =====
  // 최종 대물 2호 + 등불 삼형제
  { t: 76,   kind: 'big', M: 2, D: 1, F: 1, S: 2, n: 1, y: 0.45, amp: 40, freq: 0.8, spd: 92, hp: 70, fireInt: 1.7, ringN: 14 },
  { t: 77.5, kind: 'lantern', M: 2, D: 1, F: 2, S: 4, n: 3, gap: 1.0, y: 0.6, amp: 30, freq: 1.3, spd: 58, hp: 5, fireInt: 2.3 },
  // 유턴 유언탄 (뒤통수+근접주의 총복습)
  { t: 82,   kind: 'fish', M: 4, D: 1, F: 2, S: 5, n: 5, gap: 0.32, y: 0.4, spd: 165, hp: 2 },
  { t: 83.5, kind: 'fish', M: 2, D: 5, F: 2, S: 1, n: 4, gap: 0.45, y: 0.65, amp: 20, freq: 3, spd: 162, hp: 2, fireInt: 2.3 },
  // 번개 스윕 + 유령 포위 (최대)
  { t: 88,   bolt: 0.25 },
  { t: 88.5, bolt: 0.45 },
  { t: 89,   bolt: 0.65 },
  { t: 90,   kind: 'ghost', F: 5, S: 0, n: 12, spd: 64, hp: 2, radius: 320 },
  // 커튼 + 조준 협공
  { t: 95,   kind: 'jelly', M: 1, D: 2, F: 4, S: 0, n: 10, spd: 100, hp: 2 },
  { t: 96.5, kind: 'fish', M: 2, D: 1, F: 2, S: 1, n: 5, gap: 0.38, y: 0.3, amp: 22, freq: 3, spd: 124, hp: 2, fireInt: 2.0 },
  { t: 97,   kind: 'fish', M: 2, D: 1, F: 2, S: 1, n: 5, gap: 0.38, y: 0.7, amp: 22, freq: 3, spd: 124, hp: 2, fireInt: 2.0 },
  // 여정의 마지막 진주 셔틀 (배웅)
  { t: 102,  kind: 'fish', M: 7, D: 1, F: 2, S: 0, n: 8, gap: 0.24, y: 0.35, amp: 35, freq: 3, spd: 145, hp: 2 },
  { t: 103.5, kind: 'fish', M: 7, D: 1, F: 2, S: 0, n: 8, gap: 0.24, y: 0.65, amp: 35, freq: 3, spd: 145, hp: 2 },
  { t: 106,  kind: 'fish', M: 2, D: 1, F: 2, S: 0, n: 8, gap: 0.24, y: 0.5, amp: 45, freq: 2.8, spd: 148, hp: 2 },

  { t: 111, warning: true },
  { t: 115, boss: true },
];

// ------------------------------------------------------------
// 스테이지 레지스트리 — 항해도/출격/클리어 기록의 단일 참조점
// boss는 지연 생성(팩토리) — boss.js가 뒤에 로드되어도 OK
// dark: 어둠 오버레이 농도 (0 = 없음)
// ------------------------------------------------------------
const STAGES = [
  { id: 'stage1', name: '산호 초입',   timeline: STAGE1_TIMELINE, boss: (g) => new Boss(g),
    clearMsg: '별빛 길이 한 칸 이어졌다... 팡팡이 친구가 되었다!',
    clearMsgAgain: '팡팡과 한바탕 놀아줬다. 다음엔 자기가 이긴다나 뭐라나.', friendColor: '#e8c84e' },
  { id: 'stage2', name: '해파리 초원', timeline: STAGE2_TIMELINE, boss: (g) => new BossMongsil(g),
    clearMsg: '별빛 길이 한 칸 이어졌다... 몽실이 친구가 되었다!',
    clearMsgAgain: '몽실의 등불 정원을 다시 구경하고 왔다~', friendColor: '#c9a3ff' },
  { id: 'stage3', name: '거북이 고속도로', timeline: STAGE3_TIMELINE, boss: (g) => new BossSsing(g),
    clearMsg: '별빛 길이 한 칸 이어졌다... 씽씽이 친구가 되었다!',
    clearMsgAgain: '씽씽과의 리턴 매치 승리! 오늘도 최고 속도 배송.', friendColor: '#8fa3e8' },
  { id: 'stage4', name: '심해 협곡', timeline: STAGE4_TIMELINE, boss: (g) => new BossChorong(g),
    clearMsg: '별빛 길이 한 칸 이어졌다... 초롱이가 친구가 되었다!',
    clearMsgAgain: '초롱이의 별밤을 또 보고 왔다. 기다리고 있었대.', friendColor: '#7ee8e0', dark: 0.86 },
  { id: 'stage5', name: '난파선 묘지', timeline: STAGE5_TIMELINE, boss: (g) => new BossBuu(g),
    clearMsg: '별빛 길이 한 칸 이어졌다... 부우가 친구가 되었다!',
    clearMsgAgain: '부우와 숨바꼭질 한 판. 오늘도 안 놀라줬다.', friendColor: '#9fe8b8', dark: 0.3 },
  { id: 'stage6', name: '폭풍 수면', timeline: STAGE6_TIMELINE, boss: (g) => new BossUreu(g),
    clearMsg: '별빛 길이 한 칸 이어졌다... 우르릉이 친구가 되었다!',
    clearMsgAgain: '폭풍의 왕님은 오늘도 관대하게 봐주셨다고 한다.', friendColor: '#ffd76e', storm: true },
  { id: 'stage7', name: '용궁 앞바다', timeline: STAGE7_TIMELINE, boss: (g) => new BossHwii(g),
    clearMsg: '폭풍이 걷혔다... 집이다!',
    clearMsgAgain: '휘이의 눈 속은 오늘도 고요했다.', friendColor: '#b8d8f0', storm: true, stormLevel: 0.55 },
];

class Spawner {
  constructor(timeline, game) {
    this.timeline = timeline.slice();
    this.game = game;
    this.idx = 0;
    this.pending = [];       // 시차 스폰 대기열 {at, spec}
    this.nextGroupId = 1;
  }

  update(t, dt) {
    // 타임라인 소비
    while (this.idx < this.timeline.length && this.timeline[this.idx].t <= t) {
      const e = this.timeline[this.idx++];
      if (e.warning) { this.game.startBossWarning(); continue; }
      if (e.boss) { this.game.startBoss(); continue; }
      if (e.ride) { this.game.startRide(e.ride); continue; }
      if (e.bolt !== undefined) { this.game.spawnBolt(e.bolt); continue; }
      this.expand(e, t);
    }
    // 대기열 소비
    for (let i = this.pending.length - 1; i >= 0; i--) {
      if (this.pending[i].at <= t) {
        this.game.enemies.push(new Enemy(this.pending[i].spec));
        this.pending.splice(i, 1);
      }
    }
  }

  done() { return this.idx >= this.timeline.length && this.pending.length === 0; }

  // 웨이브 데이터(F·D축) → 개별 스폰 스펙으로 전개
  expand(w, now) {
    const gid = this.nextGroupId++;
    const specs = [];
    const baseY = (w.y ?? 0.5) * CFG.H;
    const baseX = (w.x ?? 0.5) * CFG.W;

    // 난이도 모디파이어 — 타임라인은 한 벌, 밀도만 스폰 시점에 조정
    const D = this.game.D ?? DIFFS[0];
    const common = (over) => Object.assign({
      kind: w.kind, M: w.M ?? 1, S: w.S ?? 0,
      hp: w.kind === 'big' ? Math.round(w.hp * (D.bigHp ?? 1)) : w.hp, // 대물은 난이도 체력 배율
      spd: w.spd,
      amp: w.amp ?? 0, freq: w.freq ?? 3,
      fireInt: w.fireInt !== undefined ? w.fireInt * D.fireInt : undefined,
      ringN: w.S === 2 ? (w.ringN ?? 8) + D.ringN : w.ringN,
      groupId: gid,
      targetX: (w.targetX ?? 0.68) * CFG.W, pauseDur: w.pauseDur,
      dirX: 0, dirY: 0,
    }, over);

    if (w.kind === 'wreck') {
      // 난파선 지형: 위(top)/아래(bot)에서 frac 높이만큼 통로를 좁힘
      const h = (w.frac ?? 0.4) * CFG.H;
      const y = w.side === 'top' ? h / 2 : CFG.H - h / 2;
      specs.push({ at: now, spec: common({ x: CFG.W + 60, y, hp: 999999, wreckW: 74, wreckH: h, side: w.side }) });
      this.game.groups[gid] = { total: 1, killed: 0, escaped: 0, isFormation: false };
      specs.forEach(sp => this.pending.push(sp));
      return;
    }

    if (w.F === 5) {
      // 링: 플레이어를 감싸고 사방에서 조여온다 (후반용 포위)
      const cx = this.game.player.x, cy = this.game.player.y;
      const rad = w.radius ?? 300;
      for (let i = 0; i < w.n; i++) {
        const a = (i / w.n) * 6.28 + Math.random() * 0.25;
        let x = cx + Math.cos(a) * rad, y = cy + Math.sin(a) * rad;
        x = Math.min(x, CFG.W + 90);
        y = Math.max(-70, Math.min(CFG.H + 70, y));
        const d = Math.hypot(cx - x, cy - y) || 1;
        specs.push({ at: now, spec: common({ x, y, dirX: (cx - x) / d, dirY: (cy - y) / d, M: 1 }) });
      }
    } else if (w.D === 4) {
      // 대각 진입: 우상→좌하 (dir:'up'이면 우하→좌상)
      const goingDown = w.dir !== 'up';
      for (let i = 0; i < w.n; i++) {
        specs.push({ at: now + i * (w.gap ?? 0.35), spec: common({
          x: CFG.W * (0.55 + Math.random() * 0.4),
          y: goingDown ? -30 : CFG.H + 30,
          dirX: -0.55, dirY: goingDown ? 0.83 : -0.83,
          M: 1,
        }) });
      }
    } else if (w.D === 1) {
      // 우→좌 진입
      if (w.F === 2 || w.F === 6) {
        // 종대(뱀) / 시차 웨이브: gap 간격 순차 스폰, 같은 경로
        const phase = Math.random() * 6.28;
        for (let i = 0; i < w.n; i++) {
          specs.push({ at: now + i * w.gap, spec: common({ x: CFG.W + 30, y: baseY, dirX: -1, phase }) });
        }
      } else if (w.F === 3) {
        // V자: 선두 1 + 뒤로 갈수록 상하 벌어짐, 동시 진입
        for (let i = 0; i < w.n; i++) {
          const rank = i === 0 ? 0 : Math.ceil(i / 2);
          const side = i === 0 ? 0 : (i % 2 === 1 ? -1 : 1);
          specs.push({ at: now, spec: common({
            x: CFG.W + 30 + rank * 34,
            y: baseY + side * rank * 42,
            targetX: (w.targetX ?? 0.68) * CFG.W + rank * 34,
            dirX: -1,
          }) });
        }
      } else if (w.F === 4) {
        // 벽: 세로 일렬 동시 진입, 틈 1개 (2칸 폭)
        const gapIdx = 1 + Math.floor(Math.random() * (w.n - 2));
        const spacing = (CFG.H - 60) / (w.n);
        for (let i = 0; i <= w.n; i++) {
          if (i === gapIdx || i === gapIdx + 1) continue;
          specs.push({ at: now, spec: common({ x: CFG.W + 30, y: 40 + i * spacing, dirX: -1 }) });
        }
      } else {
        // F1 단기
        for (let i = 0; i < w.n; i++) {
          specs.push({ at: now + i * (w.gap ?? 0), spec: common({ x: CFG.W + 30, y: baseY, dirX: -1 }) });
        }
      }
    } else if (w.D === 5) {
      // 좌→우 (등 뒤에서 추월!) — 후방탄·시야 반전 교육
      if (w.F === 2 || w.F === 6) {
        const phase = Math.random() * 6.28;
        for (let i = 0; i < w.n; i++) {
          specs.push({ at: now + i * (w.gap ?? 0.4), spec: common({ x: -30, y: baseY, dirX: 1, phase }) });
        }
      } else {
        for (let i = 0; i < w.n; i++) {
          specs.push({ at: now + i * (w.gap ?? 0), spec: common({ x: -30, y: baseY, dirX: 1 }) });
        }
      }
    } else if (w.D === 2 && w.F === 4) {
      // 커튼: 가로 전폭에서 동시 낙하, 틈 2칸 (세로 스테이지의 "벽")
      const gapIdx = 1 + Math.floor(Math.random() * (w.n - 2));
      const spacing = (CFG.W - 80) / w.n;
      for (let i = 0; i <= w.n; i++) {
        if (i === gapIdx || i === gapIdx + 1) continue;
        specs.push({ at: now, spec: common({ x: 40 + i * spacing, y: -30, dirX: -0.1, dirY: 1 }) });
      }
    } else if (w.D === 2) {
      // 상→하 낙하 (좌로 살짝 흘러내림)
      for (let i = 0; i < w.n; i++) {
        specs.push({ at: now + i * (w.gap ?? 0.5), spec: common({
          x: baseX + (Math.random() - 0.5) * CFG.W * 0.45,
          y: -30, dirX: -0.25, dirY: 1,
        }) });
      }
    } else if (w.D === 3) {
      // 하→상 부상 (기포처럼 올라옴)
      for (let i = 0; i < w.n; i++) {
        specs.push({ at: now + i * (w.gap ?? 0.5), spec: common({
          x: baseX + (Math.random() - 0.5) * CFG.W * 0.45,
          y: CFG.H + 30, dirX: -0.25, dirY: -1,
        }) });
      }
    }

    // 붙박이 포대는 화면 오른쪽 바닥에서 등장
    if (w.M === 6) {
      specs.length = 0;
      specs.push({ at: now, spec: common({ x: CFG.W + 20, y: baseY }) });
    }

    // 편대 전멸 보너스 추적 등록
    this.game.groups[gid] = { total: specs.length, killed: 0, escaped: 0, isFormation: w.F >= 2 };
    specs.forEach(s => this.pending.push(s));
  }
}
