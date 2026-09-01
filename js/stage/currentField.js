(function initStageCurrentField(root, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.StageCurrentField = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function stageCurrentFieldFactory() {
  'use strict';

  function finite(value, fallback = 0) {
    return Number.isFinite(Number(value)) ? Number(value) : fallback;
  }

  function sample(field, point) {
    if (!field) return { x: 0, y: 0 };
    const center = field.center || { x: 0, y: 0 };
    const target = point || center;
    const dx = finite(target.x) - finite(center.x);
    const dy = finite(target.y) - finite(center.y);
    const distance = Math.hypot(dx, dy) || 1;
    const rx = dx / distance;
    const ry = dy / distance;
    const radialStrength = Number.isFinite(Number(field.innerRadius)) && distance < Number(field.innerRadius)
      ? finite(field.innerRadialStrength, finite(field.radialStrength))
      : finite(field.radialStrength);
    const tangentialStrength = finite(field.tangentialStrength);
    return {
      x: rx * radialStrength - ry * tangentialStrength,
      y: ry * radialStrength + rx * tangentialStrength,
    };
  }

  return Object.freeze({ sample });
});
