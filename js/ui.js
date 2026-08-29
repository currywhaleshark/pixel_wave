// ============================================================
// ui.js — 레트로 픽셀 UI 크롬 (PXUI)
//
// 규칙: UI 크롬에 둥근 모서리·그라데이션·소프트 글로우를 쓰지 않는다.
//   모서리 2px 잘린 상자(notch) + 하드 오프셋 그림자 + 플랫 컬러 + 칸 게이지.
//   두께 단위 u=2 — 월드 픽셀(2배 확대)과 같은 스케일이라 게임 화면과 결이 맞는다.
// 인게임 이펙트(탄 글로우·등불 등)는 게임 아트이므로 이 규칙의 대상이 아니다.
// ============================================================
const PXUI = {
  u: 2,

  // 모서리가 u만큼 잘린 채움 사각형 (레트로 창 실루엣)
  notched(ctx, x, y, w, h, color) {
    const u = this.u;
    x = Math.round(x); y = Math.round(y); w = Math.round(w); h = Math.round(h);
    ctx.fillStyle = color;
    ctx.fillRect(x + u, y, w - u * 2, h);
    ctx.fillRect(x, y + u, w, h - u * 2);
  },

  // 테두리만 (두께 u)
  frame(ctx, x, y, w, h, color) {
    const u = this.u;
    x = Math.round(x); y = Math.round(y); w = Math.round(w); h = Math.round(h);
    ctx.fillStyle = color;
    ctx.fillRect(x + u, y, w - u * 2, u);
    ctx.fillRect(x + u, y + h - u, w - u * 2, u);
    ctx.fillRect(x, y + u, u, h - u * 2);
    ctx.fillRect(x + w - u, y + u, u, h - u * 2);
  },

  // 이중 구조 패널: 하드 그림자 → 밝은 테두리 → 플랫 채움 (RPG 대화창 문법)
  panel(ctx, x, y, w, h, opt = {}) {
    const u = this.u;
    this.notched(ctx, x + u * 2, y + u * 2, w, h, opt.shadow ?? 'rgba(2, 6, 24, 0.6)');
    this.notched(ctx, x, y, w, h, opt.border ?? '#cfe0ff');
    ctx.fillStyle = opt.fill ?? '#0b1c4e';
    ctx.fillRect(x + u, y + u, w - u * 2, h - u * 2);
  },

  // 칩/슬롯: 작은 플랫 상자
  chip(ctx, r, opt = {}) {
    this.notched(ctx, r.x, r.y, r.w, r.h, opt.border ?? 'rgba(210,225,255,0.35)');
    ctx.fillStyle = opt.fill ?? 'rgba(6, 14, 40, 0.9)';
    ctx.fillRect(r.x + this.u, r.y + this.u, r.w - this.u * 2, r.h - this.u * 2);
  },

  // 버튼: 그림자 + 테두리 = 강조색, 채움은 남색 (pressed면 반전)
  button(ctx, r, label, color, opt = {}) {
    const u = this.u;
    this.notched(ctx, r.x + u, r.y + u, r.w, r.h, 'rgba(2, 6, 24, 0.6)');
    this.notched(ctx, r.x, r.y, r.w, r.h, color);
    ctx.fillStyle = opt.pressed ? color : '#0b1c4e';
    ctx.fillRect(r.x + u, r.y + u, r.w - u * 2, r.h - u * 2);
    ctx.fillStyle = opt.pressed ? '#0b1c4e' : color;
    ctx.font = Fonts.f(opt.big ? 18 : 14, true);
    ctx.textAlign = 'center';
    ctx.fillText(label, r.x + r.w / 2, r.y + r.h / 2 + (opt.big ? 7 : 5));
  },

  // 하드 그림자 텍스트 (타이틀·헤더·메시지)
  text(ctx, str, x, y, size, color, opt = {}) {
    ctx.font = Fonts.f(size, opt.bold ?? true);
    ctx.textAlign = opt.align ?? 'center';
    const off = size >= 30 ? 3 : 2;
    ctx.fillStyle = opt.shadow ?? 'rgba(6, 10, 30, 0.8)';
    ctx.fillText(str, x + off, y + off);
    ctx.fillStyle = color;
    ctx.fillText(str, x, y);
  },

  // 칸 게이지 (부드러운 바 대신)
  cells(ctx, x, y, n, filled, opt = {}) {
    const cw = opt.cw ?? 8, ch = opt.ch ?? 10, gap = opt.gap ?? 2;
    for (let i = 0; i < n; i++) {
      ctx.fillStyle = i < filled ? (opt.color ?? '#7dffd8') : (opt.empty ?? 'rgba(255,255,255,0.14)');
      ctx.fillRect(x + i * (cw + gap), y, cw, ch);
    }
  },
};
