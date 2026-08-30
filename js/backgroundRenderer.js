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
      scrollScale: 1.25,
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
    5: {
      prefix: 'background.stage6',
      seaSpeed: 0.028,
      far: [0.10, 250, 0.24], mid: [0.30, 270, 0.38], near: [0.78, 270, 1],
      surface: true,
      fx: { shaft: '#9eb9d0', mote: '#829fb9', bubble: '#c2d4e2', cutout: '#304a68' },
    },
    6: {
      prefix: 'background.stage7',
      seaSpeed: 0.020,
      far: [0.08, 255, 0.25], mid: [0.26, 278, 0.38], near: [0.74, 302, 1],
      surface: true,
      fx: { shaft: '#c2c6df', mote: '#9bb9cb', bubble: '#dddceb', cutout: '#405b7d' },
    },
  },

  draw(ctx, game) {
    const stage = this.stages[game.stageIdx];
    if (!stage || game.state !== 'play') return false;
    const ids = Object.fromEntries(['sea', 'far', 'mid', 'near'].map(layer => [layer, `${stage.prefix}.${layer}`]));
    if (!Object.values(ids).every(id => Assets.ready(id))) return false;
    const u = CFG.pxUnit;
    const scroll = game.scroll * (stage.scrollScale ?? 1);
    ctx.save();
    ctx.imageSmoothingEnabled = false;
    this.drawStrip(ctx, Assets.image(ids.sea), scroll, stage.seaSpeed, 270, 1, u);
    this.drawLight(ctx, game, u, stage.fx, scroll);
    this.drawStrip(ctx, Assets.image(ids.far), scroll, ...stage.far, u);
    this.drawMotes(ctx, game, u, stage.fx);
    this.drawStrip(ctx, Assets.image(ids.mid), scroll, ...stage.mid, u);
    this.drawStrip(ctx, Assets.image(ids.near), scroll, ...stage.near, u);
    if (stage.surface) this.drawStormSurface(ctx, game);
    ctx.restore();
    return true;
  },

  drawStormSurface(ctx, game) {
    const t = Number.isFinite(game.stageT) ? game.stageT : performance.now() / 1000;
    for (let layer = 0; layer < 2; layer++) {
      const base = 26 + layer * 16;
      const amp = (14 - layer * 5) * game.stormScale;
      ctx.fillStyle = layer === 0 ? 'rgba(220,235,255,0.25)' : 'rgba(160,190,230,0.3)';
      ctx.beginPath();
      ctx.moveTo(0, 0);
      for (let x = 0; x <= CFG.W; x += 24) {
        ctx.lineTo(x, base + Math.sin(x * 0.02 + t * (2.2 - layer * 0.6) + layer * 2) * amp);
      }
      ctx.lineTo(CFG.W, 0);
      ctx.fill();
    }
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

  drawLight(ctx, game, u, palette, scroll = game.scroll) {
    const worldScroll = scroll / u;
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
