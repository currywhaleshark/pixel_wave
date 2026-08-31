// Shared background-strip and terrain-object coordinate transforms.
(function initStageLayerTransform(root) {
  'use strict';

  const PIXEL_UNIT = 2;
  const LAYERS = Object.freeze({
    stage1: Object.freeze({ near: Object.freeze({ speed: 0.82, baseline: 270, opacity: 1 }) }),
    stage2: Object.freeze({ near: Object.freeze({ speed: 0.76, baseline: 270, opacity: 1 }) }),
    stage3: Object.freeze({ near: Object.freeze({ speed: 0.84, baseline: 270, opacity: 1, scrollScale: 1.25 }) }),
    stage4: Object.freeze({ near: Object.freeze({ speed: 0.78, baseline: 270, opacity: 1 }) }),
    stage5: Object.freeze({ near: Object.freeze({ speed: 0.76, baseline: 286, opacity: 1 }) }),
    stage6: Object.freeze({ near: Object.freeze({ speed: 0.78, baseline: 270, opacity: 1 }) }),
    stage7: Object.freeze({ near: Object.freeze({ speed: 0.74, baseline: 302, opacity: 1 }) }),
  });

  function finite(value, fallback = 0) {
    const number = Number(value);
    return Number.isFinite(number) ? number : fallback;
  }

  function positiveMod(value, divisor) {
    const size = Math.max(1, Math.floor(finite(divisor, 1)));
    return ((Math.floor(finite(value)) % size) + size) % size;
  }

  function layerTravelNative(scrollLogical, speed, pixelUnit = PIXEL_UNIT, scrollScale = 1) {
    const unit = finite(pixelUnit, PIXEL_UNIT);
    return Math.floor(finite(scrollLogical) * finite(scrollScale, 1) / unit * finite(speed));
  }

  function stripOffset(scrollLogical, speed, pixelUnit, stripWidth) {
    return positiveMod(layerTravelNative(scrollLogical, speed, pixelUnit), stripWidth);
  }

  function layerConfig(backgroundPresetId, layer = 'near') {
    return LAYERS[backgroundPresetId]?.[layer] || null;
  }

  function objectPosition(item, profile, scrollLogical, options = {}) {
    const unit = finite(options.pixelUnit, PIXEL_UNIT);
    const layer = item?.payload?.anchor?.layer || profile?.binding?.layer || 'near';
    const config = options.layer || layerConfig(profile?.binding?.backgroundPresetId, layer);
    if (!item || !profile || !config) return null;
    const width = profile.binding.width;
    const objectNativeX = Math.floor(finite(item.timing?.start) / unit);
    const profileX = positiveMod(objectNativeX, width);
    const anchor = item.payload.anchor || {};
    const socket = anchor.surface === 'socket'
      ? profile.sockets.find(entry => entry.id === anchor.socketId)
      : null;
    const surface = socket?.surface || anchor.surface || 'floor';
    const surfaceY = socket?.y ?? profile.surfaces?.[surface]?.samples?.[profileX];
    if (!Number.isFinite(surfaceY)) return null;
    const scrollNativeX = layerTravelNative(scrollLogical, config.speed, unit, config.scrollScale);
    const contact = options.contact || { x: 0, y: 0 };
    const spriteAnchor = options.spriteAnchor || contact;
    const surfaceLogicalX = (objectNativeX - scrollNativeX) * unit + finite(anchor.offsetX);
    const surfaceLogicalY = (finite(config.baseline) - profile.binding.height + surfaceY) * unit + finite(anchor.offsetY);
    return {
      profileX, objectNativeX, scrollNativeX, surface,
      surfaceX: surfaceLogicalX, surfaceY: surfaceLogicalY,
      drawX: surfaceLogicalX - (finite(contact.x) - finite(spriteAnchor.x)) * unit,
      drawY: surfaceLogicalY - (finite(contact.y) - finite(spriteAnchor.y)) * unit,
    };
  }

  const api = Object.freeze({ PIXEL_UNIT, LAYERS, positiveMod, layerTravelNative, stripOffset, layerConfig, objectPosition });
  root.StageLayerTransform = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : window);
