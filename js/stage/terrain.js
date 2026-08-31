// Terrain profile semantic validation and reviewed-socket resolution.
(function initStageTerrain(root) {
  'use strict';

  const Transform = root.StageLayerTransform || (typeof require === 'function' ? require('./layerTransform.js') : null);

  const OBJECTS = Object.freeze({
    'coral-turret': Object.freeze({
      id: 'coral-turret', name: '산호 포대', spriteId: 'enemy.turret',
      enemyKind: 'turret',
      placementClassId: 'coral-turret-small', layer: 'near', allowContinuous: false,
      contact: Object.freeze({ floor: Object.freeze({ x: 8, y: 14 }) }),
      spriteAnchor: Object.freeze({ x: 8, y: 7 }), renderOrder: 'before-near',
    }),
  });

  function validateProfile(profile) {
    const errors = [];
    const warnings = [];
    if (profile?.format !== 'pixel-wave-terrain-profile' || profile?.schemaVersion !== 1) errors.push('지형 프로필 형식 또는 버전이 올바르지 않습니다.');
    const width = Number(profile?.binding?.width);
    const height = Number(profile?.binding?.height);
    for (const surfaceId of ['floor', 'ceiling']) {
      const surface = profile?.surfaces?.[surfaceId];
      if (!Array.isArray(surface?.samples) || surface.samples.length !== width) errors.push(`${surfaceId} samples 길이가 이미지 너비와 다릅니다.`);
      if (!Array.isArray(surface?.confidence) || surface.confidence.length !== width) errors.push(`${surfaceId} confidence 길이가 이미지 너비와 다릅니다.`);
      for (const value of surface?.samples || []) if (value !== null && (!Number.isInteger(value) || value < 0 || value >= height)) errors.push(`${surfaceId} surface Y가 이미지 범위를 벗어납니다.`);
    }
    const ids = new Set();
    const classes = new Set((profile?.placementClasses || []).map(entry => entry.id));
    for (const socket of profile?.sockets || []) {
      if (ids.has(socket.id)) errors.push(`지형 소켓 '${socket.id}'가 중복됩니다.`);
      ids.add(socket.id);
      if (!classes.has(socket.classId)) errors.push(`지형 소켓 '${socket.id}'의 배치 클래스가 없습니다.`);
      if (socket.x < 0 || socket.x >= width || socket.y < 0 || socket.y >= height) errors.push(`지형 소켓 '${socket.id}'가 프로필 범위를 벗어납니다.`);
      if (socket.reviewStatus === 'pending') warnings.push(`지형 소켓 '${socket.id}' 검토가 필요합니다.`);
    }
    const pending = (profile?.sockets || []).filter(socket => socket.reviewStatus === 'pending').length;
    if (profile?.review?.pendingSocketCount !== pending) errors.push('pendingSocketCount가 실제 소켓 상태와 다릅니다.');
    if (profile?.review?.status === 'approved') {
      if (pending) errors.push('승인된 지형 프로필에 미검토 소켓이 남아 있습니다.');
      if (profile.review.reviewedAssetSha256 !== profile.binding.assetSha256) errors.push('승인한 전경 이미지 해시가 현재 프로필과 다릅니다.');
    }
    if (profile?.generation?.mode === 'alpha-fallback') warnings.push('알파 기반 지형은 구조 마스크보다 신뢰도가 낮습니다.');
    return { errors: [...new Set(errors)], warnings: [...new Set(warnings)] };
  }

  function validateItem(item, profile) {
    const errors = [];
    const warnings = [];
    const definition = OBJECTS[item?.payload?.objectId];
    if (!definition) return { errors: [`알 수 없는 지형 오브젝트 '${item?.payload?.objectId}'입니다.`], warnings };
    const anchor = item.payload.anchor || {};
    if (anchor.layer !== definition.layer) errors.push(`${item.id}의 레이어가 ${definition.layer}가 아닙니다.`);
    if (!definition.allowContinuous && anchor.surface !== 'socket') warnings.push(`${item.id}은 피해 오브젝트이므로 승인 소켓 배치를 권장합니다.`);
    if (profile && anchor.surface === 'socket') {
      const socket = profile.sockets.find(entry => entry.id === anchor.socketId);
      if (!socket) errors.push(`${item.id}이 존재하지 않는 소켓 '${anchor.socketId}'을 사용합니다.`);
      else {
        const expectedX = Transform.positiveMod(Math.floor(Number(item.timing.start) / Transform.PIXEL_UNIT), profile.binding.width);
        if (socket.x !== expectedX) errors.push(`${item.id}의 거리와 소켓 X가 일치하지 않습니다.`);
        if (socket.classId !== definition.placementClassId) errors.push(`${item.id}의 소켓 배치 클래스가 오브젝트와 다릅니다.`);
        if (socket.reviewStatus !== 'approved') errors.push(`${item.id}이 승인되지 않은 소켓을 사용합니다.`);
      }
    }
    return { errors, warnings };
  }

  function resolveObjects(items, profile, scroll, options = {}) {
    if (!profile) return [];
    return (items || []).filter(item => item.type === 'terrain-object').map(item => {
      const definition = OBJECTS[item.payload.objectId];
      if (!definition) return null;
      const contact = definition.contact[item.payload.anchor?.surface === 'ceiling' ? 'ceiling' : 'floor'] || definition.contact.floor;
      const transform = Transform.objectPosition(item, profile, scroll, {
        ...options, contact, spriteAnchor: definition.spriteAnchor,
      });
      return transform ? { itemId: item.id, definition, item, ...transform } : null;
    }).filter(Boolean);
  }

  const api = Object.freeze({ OBJECTS, validateProfile, validateItem, resolveObjects });
  root.StageTerrain = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : window);
