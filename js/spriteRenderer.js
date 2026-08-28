// ============================================================
// spriteRenderer.js — 스프라이트 선택 · 프레임 재생 · 좌우 반전 · 위치 정수 스냅
//
// 호출부는 게임 좌표(960×540)를 그대로 넘긴다. 내부에서 월드 픽셀 격자에 스냅해
// 정확히 픽셀 경계에 얹는다 — 반픽셀에 걸치면 확대 시 뭉개진다.
//
// 반환값이 false면 스프라이트가 아직 없다는 뜻 → 호출부는 기존 도형으로 그린다.
//   if (!Sprites.draw(ctx, 'enemy.fish', x, y, { t })) drawTemporaryShape();
// ============================================================
const Sprites = {
  outlineFrames: new Map(),

  // opt: { t(초, 애니메이션), frame(고정 프레임), flipX, alpha, rot(라디안), scale, outline, outlineAlpha }
  draw(ctx, id, x, y, opt = {}) {
    if (!Assets.has(id)) return false;   // 아트 미완성 → 호출부가 도형 폴백
    const s = SPRITES[id];

    const img = Assets.image(s.sheet);
    const u = CFG.pxUnit;                       // 월드 픽셀 → 게임 좌표

    // 프레임 선택
    let fi = opt.frame ?? 0;
    if (opt.frame === undefined && s.frames > 1 && s.fps > 0) {
      fi = Math.floor((opt.t ?? 0) * s.fps) % s.frames;
    }
    fi = Math.max(0, Math.min(s.frames - 1, fi));

    // 위치를 월드 픽셀 격자에 스냅
    const px = Math.round(x / u) * u;
    const py = Math.round(y / u) * u;

    const w = s.w * u, h = s.h * u;
    const ox = -s.ax * u, oy = -s.ay * u;

    ctx.save();
    if (opt.alpha !== undefined) ctx.globalAlpha *= opt.alpha;
    ctx.imageSmoothingEnabled = false;
    ctx.translate(px, py);
    if (opt.rot) ctx.rotate(opt.rot);
    if (opt.scale && opt.scale !== 1) ctx.scale(opt.scale, opt.scale);
    if (opt.flipX) ctx.scale(-1, 1);
    if (opt.outline) {
      const outlined = this.getOutlineFrame(img, id, s, fi, opt.outline);
      const spriteAlpha = ctx.globalAlpha;
      ctx.globalAlpha *= opt.outlineAlpha ?? 1;
      ctx.drawImage(outlined, ox - u, oy - u, w + 2 * u, h + 2 * u);
      ctx.globalAlpha = spriteAlpha;
    }
    ctx.drawImage(img, s.x + fi * s.w, s.y, s.w, s.h, ox, oy, w, h);
    ctx.restore();
    return true;
  },

  getOutlineFrame(img, id, s, fi, color) {
    const key = `${id}:${fi}:${color}`;
    if (this.outlineFrames.has(key)) return this.outlineFrames.get(key);
    const canvas = document.createElement('canvas');
    canvas.width = s.w + 2;
    canvas.height = s.h + 2;
    const frameCtx = canvas.getContext('2d');
    frameCtx.imageSmoothingEnabled = false;
    const crossOffsets = [[1, 0], [0, 1], [2, 1], [1, 2]];
    for (const [dx, dy] of crossOffsets) {
      frameCtx.drawImage(img, s.x + fi * s.w, s.y, s.w, s.h, dx, dy, s.w, s.h);
    }
    frameCtx.globalCompositeOperation = 'source-in';
    frameCtx.fillStyle = color;
    frameCtx.fillRect(0, 0, canvas.width, canvas.height);
    frameCtx.globalCompositeOperation = 'source-over';
    this.outlineFrames.set(key, canvas);
    return canvas;
  },

  // 스프라이트 유무만 확인 (분기용)
  has(id) { return Assets.has(id); },
};
