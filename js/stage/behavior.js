// ============================================================
// stage/behavior.js — 이동·무기 프리셋 값의 공유 정규화·검증
// 레지스트리 필드 메타데이터를 컴파일러와 편집기가 함께 사용한다.
// ============================================================
(function initStageBehavior(root) {
  'use strict';

  const Registry = root.StageRegistry || (typeof require === 'function' ? require('./registry.js') : null);

  function clone(value) {
    return value === undefined ? undefined : JSON.parse(JSON.stringify(value));
  }

  function definition(category, presetId) {
    return Registry.get(category, presetId);
  }

  function rawFieldValue(preset, field) {
    return field.target === 'root' ? preset?.[field.key] : preset?.params?.[field.key];
  }

  function fieldDefault(field, context = {}) {
    const entryKey = context.entryPresetId === 'diagonal'
      ? `diagonal-${context.entryVertical === 'up' ? 'up' : 'down'}`
      : context.entryPresetId;
    return field.defaults?.[entryKey] ?? field.default;
  }

  function effectiveFieldValue(preset, field, context = {}) {
    const value = rawFieldValue(preset, field);
    return value === undefined ? fieldDefault(field, context) : value;
  }

  function setFieldValue(preset, field, value) {
    if (field.target === 'root') preset[field.key] = value;
    else {
      preset.params = preset.params && typeof preset.params === 'object' && !Array.isArray(preset.params)
        ? preset.params
        : {};
      preset.params[field.key] = value;
    }
  }

  function normalize(category, raw, fallbackId) {
    const presetId = Registry.knows(category, raw?.presetId) ? raw.presetId : fallbackId;
    const output = raw && typeof raw === 'object' && !Array.isArray(raw) ? clone(raw) : {};
    output.presetId = presetId;
    const presetDefinition = definition(category, presetId);
    for (const field of presetDefinition?.fields || []) {
      const value = rawFieldValue(output, field);
      if (value === undefined) continue;
      const number = Number(value);
      if (Number.isFinite(number)) setFieldValue(output, field, field.integer ? Math.round(number) : number);
    }
    if (output.params && !Object.keys(output.params).length) delete output.params;
    return output;
  }

  function effective(category, raw, fallbackId, context = {}) {
    const output = normalize(category, raw, fallbackId);
    const presetDefinition = definition(category, output.presetId);
    for (const field of presetDefinition?.fields || []) {
      if (rawFieldValue(output, field) === undefined) setFieldValue(output, field, fieldDefault(field, context));
    }
    return output;
  }

  function validate(category, raw, noun) {
    const errors = [];
    if (!Registry.knows(category, raw?.presetId)) return errors;
    const presetDefinition = definition(category, raw.presetId);
    for (const field of presetDefinition?.fields || []) {
      const value = rawFieldValue(raw, field);
      if (value === undefined) continue;
      const number = Number(value);
      if (!Number.isFinite(number) || number < field.min || number > field.max || (field.integer && !Number.isInteger(number))) {
        errors.push(`${noun} '${presetDefinition.name}'의 ${field.label} 값이 올바르지 않습니다.`);
      }
    }
    return errors;
  }

  const api = Object.freeze({
    rawFieldValue,
    fieldDefault,
    effectiveFieldValue,
    normalizeMovement: raw => normalize('movementPresets', raw, 'straight'),
    effectiveMovement: (raw, context) => effective('movementPresets', raw, 'straight', context),
    validateMovement: raw => validate('movementPresets', raw, '이동'),
    normalizeWeapon: raw => normalize('weaponPresets', raw, 'none'),
    effectiveWeapon: (raw, context) => effective('weaponPresets', raw, 'none', context),
    validateWeapon: raw => validate('weaponPresets', raw, '무기'),
  });
  root.StageBehavior = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : window);
