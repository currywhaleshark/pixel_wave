// ============================================================
// backgroundRenderer.js — native 480×270 water FX + 1440px seamless strips
// Each depth image spans three viewports and wraps as a single connected reef.
// ============================================================
const Backgrounds = {
  stages: {
    0: {
      prefix: 'background.stage1',
      seaSpeed: 0.025,
      far: [0.14, 245, 0.28], mid: [0.38, 270, 0.42], near: [0.82, 270, 1],
      fx: { shaft: '#52b8c4', mote: '#86cfc8', bubble: '#a7ddd4', cutout: '#267fa8' },
    },
    1: {
      prefix: 'background.stage2',
      seaSpeed: 0.02,
      far: [0.10, 245, 0.24], mid: [0.30, 270, 0.40], near: [0.76, 270, 1],
      fx: { shaft: '#9785d6', mote: '#b9a3e1', bubble: '#d6c8f0', cutout: '#51469f' },
    },
    2: {
      prefix: 'background.stage3',
      seaSpeed: 0.035,
      far: [0.12, 245, 0.24], mid: [0.34, 270, 0.40], near: [0.84, 270, 1],
      fx: { shaft: '#77e1d6', mote: '#a6eadb', bubble: '#d5f4e7', cutout: '#0a7f94' },
    },
    3: {
      prefix: 'background.stage4',
      seaSpeed: 0.018,
      far: [0.10, 252, 0.20], mid: [0.30, 270, 0.34], near: [0.78, 270, 1],
      fx: { shaft: '#304f91', mote: '#526fa8', bubble: '#7488ba', cutout: '#091b44' },
    },
    4: {
      prefix: 'background.stage5',
      seaSpeed: 0.016,
      far: [0.09, 252, 0.22], mid: [0.28, 280, 0.36], near: [0.76, 286, 1],
      fx: { shaft: '#356f76', mote: '#5d8b82', bubble: '#8fb1a2', cutout: '#102f37' },
    },
  },

  draw(ctx, game) {
    const stage = this.stages[game.stageIdx];
    if (!stage || game.state !== 'play') return false;
    const ids = Object.fromEntries(['sea', 'far', 'mid', 'near'].map(layer => [layer, `${stage.prefix}.${layer}`]));
    if (!Object.values(ids).every(id => Assets.ready(id))) return false;
    const u = CFG.pxUnit;
    ctx.save();
    ctx.imageSmoothingEnabled = false;
    this.drawStrip(ctx, Assets.image(ids.sea), game.scroll, stage.seaSpeed, 270, 1, u);
    this.drawLight(ctx, game, u, stage.fx);
    this.drawStrip(ctx, Assets.image(ids.far), game.scroll, ...stage.far, u);
    this.drawMotes(ctx, game, u, stage.fx);
    this.drawStrip(ctx, Assets.image(ids.mid), game.scroll, ...stage.mid, u);
    this.drawStrip(ctx, Assets.image(ids.near), game.scroll, ...stage.near, u);
    ctx.restore();
    return true;
  },

  drawWater(ctx, u) {
    const bands = [
      [0, 24, this.palette.surface], [24, 50, this.palette.shelf],
      [50, 86, this.palette.shallow], [86, 132, this.palette.open],
      [132, 184, this.palette.lower], [184, 270, this.palette.deep],
    ];
    for (const [y, h, color] of bands) {
      ctx.fillStyle = color;
      ctx.fillRect(0, y * u, CFG.W, h * u);
    }
    // Sparse ordered transitions instead of full-screen error-diffusion dithering.
    const transitions = [[23, this.palette.shelf], [49, this.palette.shallow], [85, this.palette.open], [131, this.palette.lower]];
    for (const [y, color] of transitions) {
      ctx.fillStyle = color;
      for (let x = (y / 2) % 4; x < CFG.WORLD_W; x += 6) ctx.fillRect(x * u, y * u, 2 * u, u);
    }
  },

  drawLight(ctx, game, u, palette) {
    const worldScroll = game.scroll / u;
    ctx.fillStyle = palette.shaft;
    for (let i = 0; i < 3; i++) {
      const x = Math.round(((i * 239 - worldScroll * 0.025) % 720 + 720) % 720) - 70;
      ctx.beginPath();
      ctx.moveTo(x * u, 0);
      ctx.lineTo((x + 15) * u, 0);
      ctx.lineTo((x - 12) * u, 151 * u);
      ctx.lineTo((x - 21) * u, 151 * u);
      ctx.closePath();
      ctx.fill();
    }
  },

  drawStrip(ctx, image, scroll, speed, baseline, opacity, u) {
    const stripWidth = image.width;
    const offset = Math.floor(((scroll / u * speed) % stripWidth + stripWidth) % stripWidth);
    const start = -offset;
    const y = baseline - image.height;
    const previousAlpha = ctx.globalAlpha;
    ctx.globalAlpha = previousAlpha * opacity;
    for (let x = start; x < CFG.WORLD_W; x += stripWidth) {
      ctx.drawImage(image, x * u, y * u, stripWidth * u, image.height * u);
    }
    if (start > 0 || start + stripWidth < CFG.WORLD_W) {
      const x = start + (start > 0 ? -stripWidth : stripWidth);
      ctx.drawImage(image, x * u, y * u, stripWidth * u, image.height * u);
    }
    ctx.globalAlpha = previousAlpha;
  },

  drawMotes(ctx, game, u, palette) {
    const t = game.stageT || performance.now() / 1000;
    for (let i = 0; i < 18; i++) {
      const seed = i * 67;
      const x = Math.round((seed * 11 + t * (2 + i % 3)) % CFG.WORLD_W);
      const y = 30 + Math.round((seed * 7 - t * (5 + i % 4) + 1000) % 160);
      ctx.fillStyle = i % 4 === 0 ? palette.bubble : palette.mote;
      const size = i % 5 === 0 ? 2 : 1;
      ctx.fillRect(x * u, y * u, size * u, size * u);
      if (size === 2) {
        ctx.fillStyle = palette.cutout;
        ctx.fillRect((x + 1) * u, (y + 1) * u, u, u);
      }
    }
  },
};
