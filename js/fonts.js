// ============================================================
// fonts.js — 픽셀 폰트 레이어
//
// 비트맵 계열 픽셀 폰트는 "고유 크기의 정수 배"로만 또렷하다.
// (11px 폰트를 13px로 그리면 글자가 뭉개진다)
//
// 한 가지 크기만 쓰면 11·13·16px이 전부 11px로 뭉쳐 위계가 사라지므로,
// 크기가 다른 페이스를 여러 개 등록해 요청 크기에 가장 가까운 조합을 고른다.
// (갈무리는 Galmuri9 / Galmuri11 / Galmuri14 로 크기별 폰트가 따로 나온다)
//
// 폰트 파일이 없으면 loaded=false → sans-serif 폴백. 게임은 그대로 동작한다.
// 후보·라이선스·배치는 docs/ART_SPEC.md 7장 참고.
// ============================================================
const Fonts = {
  // index.html의 @font-face와 이름을 맞출 것. 위에서부터 확인해 로드된 것만 쓴다.
  // hasBold: 진짜 볼드 페이스가 있는 폰트만 볼드를 요청한다
  //          (없는데 bold를 붙이면 브라우저가 합성해 획이 뭉개진다)
  faces: [
    { family: "'Galmuri9'",  native: 9,  hasBold: false, ok: false },
    { family: "'Galmuri11'", native: 11, hasBold: true,  ok: false },
  ],
  fallback: 'sans-serif',
  loaded: false,

  init() {
    if (!document.fonts || !document.fonts.load) return;
    for (const face of this.faces) {
      document.fonts.load(`${face.native}px ${face.family}`)
        .then(() => {
          face.ok = document.fonts.check(`${face.native}px ${face.family}`);
          this.loaded = this.faces.some(f => f.ok);
          if (face.ok) console.log(`[fonts] 픽셀 폰트 적용: ${face.family} (${face.native}px)`);
        })
        .catch(() => { face.ok = false; });
    }
  },

  // 요청 크기 → 실제 폰트 문자열
  // 로드된 페이스들 중 "고유 크기 × 정수배"가 요청에 가장 가까운 것을 고른다.
  // 픽셀 폰트엔 합성 볼드를 쓰지 않는다 (획이 뭉개짐 — 강조는 색·크기로).
  f(px, bold) {
    if (!this.loaded) return `${bold ? 'bold ' : ''}${Math.round(px)}px ${this.fallback}`;
    let best = null, bestDiff = Infinity, bestSize = 0;
    for (const face of this.faces) {
      if (!face.ok) continue;
      // 볼드를 원하면 진짜 볼드가 있는 페이스를 우선 (없으면 일반 페이스로 대체)
      const size = Math.max(1, Math.round(px / face.native)) * face.native;
      let diff = Math.abs(size - px);
      if (bold && !face.hasBold) diff += 2;   // 페널티: 같은 조건이면 볼드 있는 쪽
      if (diff < bestDiff || (diff === bestDiff && face.native > best.native)) {
        best = face; bestDiff = diff; bestSize = size;
      }
    }
    if (!best) return `${Math.round(px)}px ${this.fallback}`;
    const w = (bold && best.hasBold) ? 'bold ' : '';
    return `${w}${bestSize}px ${best.family}`;
  },
};

Fonts.init();
